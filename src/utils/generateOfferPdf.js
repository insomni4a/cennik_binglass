import { formatAreaM2, formatDimensions } from './dimensions'
import { formatNip } from './nipValidation'
import { getPdfMake, preloadPdfMake, yieldToMain } from './pdfMakeLoader'

export { preloadPdfMake }

const PRICE_GREEN = '#047857'
const SQUARE_ICON_SIZE = 22
const CLIENT_NAME_FONT = 15
const SPEC_ACCENT_RED = '#dc2626'
const SPEC_SQUARE_COLOR = '#9ca3af'
const SPEC_TABLE_LINE = '#d1d5db'
const SPEC_TABLE_HEADER_FILL = '#eef0f2'
const SPEC_SQUARE_ROW_FILL = '#f3f4f6'
const DRAWING_DESC_FONT = 9

function formatMoney(value) {
  return `${Number(value).toFixed(2)} zł`
}

function sumItemsAreaM2(items) {
  return items.reduce((sum, item) => sum + Number(item.area || 0), 0)
}

function greenArrowCanvas() {
  return {
    canvas: [
      { type: 'line', x1: 0, y1: 5, x2: 12, y2: 5, lineWidth: 1.4, lineColor: PRICE_GREEN },
      { type: 'line', x1: 12, y1: 5, x2: 8, y2: 2, lineWidth: 1.4, lineColor: PRICE_GREEN },
      { type: 'line', x1: 12, y1: 5, x2: 8, y2: 8, lineWidth: 1.4, lineColor: PRICE_GREEN },
    ],
    width: 14,
    height: 10,
    margin: [4, 2, 4, 0],
  }
}

function priceAfterRabatText(value) {
  return { text: formatMoney(value), color: PRICE_GREEN, bold: true }
}

function formatDate() {
  return new Date().toLocaleString('pl-PL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function buildShapeCanvas(item, maxDrawW, maxDrawH) {
  const wMm = Number(item.width)
  const hLongMm = Number(item.height)
  const hShortMm =
    item.shortSide != null && item.shortSide !== '' ? Number(item.shortSide) : null
  const isTrapezoid = hShortMm != null && hShortMm > 0
  const maxHMm = isTrapezoid ? Math.max(hLongMm, hShortMm) : hLongMm
  const scale = Math.min(maxDrawW / wMm, maxDrawH / maxHMm)
  const rectW = Math.max(wMm * scale, 8)
  const rectH = Math.max(maxHMm * scale, 6)
  const pad = 4

  if (isTrapezoid) {
    const leftH = hShortMm * scale
    const rightH = hLongMm * scale
    const yBase = pad + rectH
    return {
      canvas: [
        {
          type: 'polyline',
          lineWidth: 1,
          lineColor: '#2563eb',
          color: '#eff6ff',
          closePath: true,
          points: [
            { x: pad, y: yBase },
            { x: pad + rectW, y: yBase },
            { x: pad + rectW, y: yBase - rightH },
            { x: pad, y: yBase - leftH },
          ],
        },
      ],
      width: rectW + pad * 2,
      height: rectH + pad * 2,
    }
  }

  return {
    canvas: [
      {
        type: 'rect',
        x: pad,
        y: pad,
        w: rectW,
        h: rectH,
        r: 0,
        lineWidth: 1,
        lineColor: '#2563eb',
        color: '#eff6ff',
      },
    ],
    width: rectW + pad * 2,
    height: rectH + pad * 2,
  }
}

function buildSquareIconCanvas(size = SQUARE_ICON_SIZE, lineColor = '#2563eb') {
  const pad = 1
  return {
    canvas: [
      {
        type: 'rect',
        x: pad,
        y: pad,
        w: size - pad * 2,
        h: size - pad * 2,
        r: 0,
        lineWidth: 1.2,
        lineColor,
      },
    ],
    width: size,
    height: size,
  }
}

function getSquareRowHeight() {
  return SQUARE_ICON_SIZE + 8
}

const SQUARES_PER_ROW = 18
const SQUARE_GAP = 6
const SQUARE_ROW_GAP = 6
const SPEC_TABLE_WIDTHS = [22, '*', '*', '*', '*', '*']
const SPEC_PAGE_CONTENT_WIDTH = 515
const SPEC_ORDER_COLUMN_GAP = 10

function buildSquareRowLine(count, lineColor) {
  return {
    columns: [
      {
        width: 'auto',
        columns: Array.from({ length: count }, () => ({
          width: 'auto',
          ...buildSquareIconCanvas(SQUARE_ICON_SIZE, lineColor),
        })),
        columnGap: SQUARE_GAP,
      },
      { width: '*', text: '' },
    ],
  }
}

/** Osobny wiersz pod produktem: poziomy rząd ikon square wyrównany do lewej (max 18 w rzędzie). */
function buildSquareRowUnderProduct(ilosc, { lineColor = '#2563eb' } = {}) {
  const total = Math.max(1, Number(ilosc ?? 1))
  const rowCount = Math.ceil(total / SQUARES_PER_ROW)
  const rows = []

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const offset = rowIndex * SQUARES_PER_ROW
    rows.push({
      ...buildSquareRowLine(Math.min(SQUARES_PER_ROW, total - offset), lineColor),
      margin: [0, 0, 0, rowIndex < rowCount - 1 ? SQUARE_ROW_GAP : 0],
    })
  }

  return {
    stack: rows,
    margin: [0, 4, 0, 4],
  }
}

function buildBlackBorderField(rowHeight = getSquareRowHeight() * 2) {
  return {
    table: {
      widths: ['*'],
      heights: [rowHeight],
      body: [
        [
          {
            text: 'UWAGI',
            fontSize: DRAWING_DESC_FONT,
            bold: true,
            color: '#374151',
            fillColor: '#ffffff',
            margin: [4, 4, 4, 4],
            alignment: 'left',
          },
        ],
      ],
    },
    layout: {
      hLineWidth: () => 1,
      vLineWidth: () => 1,
      hLineColor: () => '#000000',
      vLineColor: () => '#000000',
      fillColor: () => '#ffffff',
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
    },
    margin: [0, 0, 0, 0],
  }
}

const CACHED_BLACK_BORDER_FIELD = buildBlackBorderField(getSquareRowHeight() * 2)
const EMPTY_TABLE_CELL = Object.freeze({})
const COLSPAN_PAD_7 = Object.freeze(Array.from({ length: 7 }, () => EMPTY_TABLE_CELL))

function emptyColSpanCells(colSpan, totalCols) {
  const pad = totalCols - colSpan
  if (pad === 7) return COLSPAN_PAD_7
  return Array.from({ length: pad }, () => EMPTY_TABLE_CELL)
}

function groupItemsByRodzaj(items) {
  const map = new Map()
  for (const item of items) {
    if (!map.has(item.rodzaj)) map.set(item.rodzaj, [])
    map.get(item.rodzaj).push(item)
  }
  const order = [...new Set(items.map((item) => item.rodzaj))]
  return order.map((rodzaj) => ({ rodzaj, items: map.get(rodzaj) }))
}

const SPEC_ORDER_BOX_WIDTH = 158
const SPEC_ORDER_FIELD_HEIGHT = getSquareRowHeight() * 2
const SPEC_ORDER_BORDER_COLOR = '#2563eb'

const ORDER_BORDER_FIELD_LAYOUT = {
  hLineWidth: () => 1.2,
  vLineWidth: () => 1.2,
  hLineColor: () => SPEC_ORDER_BORDER_COLOR,
  vLineColor: () => SPEC_ORDER_BORDER_COLOR,
  fillColor: () => '#ffffff',
  paddingLeft: () => 2,
  paddingRight: () => 2,
  paddingTop: () => 2,
  paddingBottom: () => 2,
}

function buildEmptyLogoBox(boxW = 128) {
  return {
    width: boxW,
    table: {
      widths: [boxW],
      body: [[{ text: '', margin: [0, 14, 0, 14] }]],
    },
    layout: ORDER_BORDER_FIELD_LAYOUT,
  }
}

function buildLabeledBorderField(label, boxW = SPEC_ORDER_BOX_WIDTH, rowHeight = SPEC_ORDER_FIELD_HEIGHT) {
  return {
    width: boxW,
    table: {
      widths: [boxW],
      heights: [rowHeight],
      body: [
        [
          {
            text: label,
            fontSize: DRAWING_DESC_FONT,
            bold: true,
            color: '#374151',
            fillColor: '#ffffff',
            margin: [4, 4, 4, 4],
            alignment: 'left',
          },
        ],
      ],
    },
    layout: ORDER_BORDER_FIELD_LAYOUT,
    margin: [0, 0, 0, 0],
  }
}

function buildSpecOrderInfoStack() {
  return [
    buildLabeledBorderField('Termin zam.'),
    {
      text: 'Numer zam.',
      fontSize: DRAWING_DESC_FONT,
      bold: true,
      color: '#374151',
      alignment: 'left',
      margin: [0, 6, 0, 4],
    },
    buildEmptyLogoBox(SPEC_ORDER_BOX_WIDTH),
  ]
}

function buildSpecOrderInfoColumn() {
  return {
    width: SPEC_ORDER_BOX_WIDTH,
    stack: buildSpecOrderInfoStack(),
  }
}

function buildSpecClientInfoColumns(quote, clientRightColumn, { includeOrderColumn = true } = {}) {
  const columns = [
    {
      width: '*',
      stack: [
        {
          text: [
            { text: 'Firma: ', bold: true },
            { text: quote.companyName, fontSize: CLIENT_NAME_FONT, color: SPEC_ACCENT_RED },
          ],
        },
        {
          text: [{ text: 'NIP: ', bold: true }, formatNip(quote.nip)],
          margin: [0, 4, 0, 0],
        },
      ],
    },
    {
      width: '*',
      stack: clientRightColumn,
    },
  ]

  if (includeOrderColumn) {
    columns.push(buildSpecOrderInfoColumn())
  }

  return { columns, columnGap: 10 }
}

function buildSpecClientDataBlock(quote, clientRightColumn, { includeOrderColumn = true } = {}) {
  return {
    stack: [
      { text: 'Dane klienta', style: 'sectionFirst' },
      buildSpecClientInfoColumns(quote, clientRightColumn, { includeOrderColumn }),
    ],
    margin: [0, 0, 0, 4],
  }
}

function buildSpecFirstPageTopBlock(quote, clientRightColumn) {
  return {
    columns: [
      {
        width: '*',
        stack: [
          ...buildSpecDocHeader(),
          {
            stack: [
              { text: 'Dane klienta', style: 'sectionFirst' },
              buildSpecClientInfoColumns(quote, clientRightColumn, { includeOrderColumn: false }),
            ],
          },
        ],
      },
      {
        width: SPEC_ORDER_BOX_WIDTH,
        stack: buildSpecOrderInfoStack(),
      },
    ],
    columnGap: 10,
    margin: [0, 0, 0, 4],
  }
}

function buildSpecDocHeader() {
  return [
    { text: 'Cennik Binglass', style: 'title' },
    { text: 'Specyfikacja wymiarowa', style: 'subtitle' },
    {
      text: `Data wygenerowania: ${formatDate()}`,
      fontSize: 9,
      color: '#888',
      margin: [0, 8, 0, 10],
    },
  ]
}

function buildOfferDocHeader() {
  return [
    { text: 'Cennik Binglass', style: 'title' },
    { text: 'Oferta / zapytanie ofertowe', style: 'subtitle' },
    {
      text: `Data wygenerowania: ${formatDate()}`,
      fontSize: 9,
      color: '#888',
      margin: [0, 8, 0, 0],
    },
  ]
}

function buildPozycjeHeader(rodzaj) {
  return {
    text: [
      { text: 'Pozycje — wymiary i formatek: ', fontSize: 11, bold: true, color: '#1e40af' },
      { text: rodzaj, fontSize: 22, bold: true, color: SPEC_ACCENT_RED },
    ],
    margin: [0, 6, 0, 8],
  }
}

function buildDrawingsHeader(rodzaj) {
  return {
    text: [
      { text: 'Rysunki wymiarowe — ', fontSize: 11, bold: true, color: '#1e40af' },
      { text: rodzaj, fontSize: 11, bold: true, color: '#1e40af' },
    ],
    margin: [0, 8, 0, 6],
  }
}

function buildRodzajDrawingsBlock(rodzaj, items, options = {}) {
  return {
    stack: [buildDrawingsHeader(rodzaj), ...buildDrawingsGrid(items, options)],
    pageBreak: 'before',
  }
}

function getDrawingScale(itemCount) {
  if (itemCount <= 2) return { maxDrawW: 130, maxDrawH: 72, marginBottom: 12 }
  if (itemCount <= 4) return { maxDrawW: 108, maxDrawH: 58, marginBottom: 10 }
  if (itemCount <= 6) return { maxDrawW: 88, maxDrawH: 46, marginBottom: 8 }
  return { maxDrawW: 74, maxDrawH: 38, marginBottom: 6 }
}
/** Rysunek szkła z wymiarami (prostokąt lub trapez przy FIX). */
function buildGlassDrawing(
  item,
  index,
  { showPrices = true, maxDrawW = 130, maxDrawH = 72, marginBottom = 12 } = {}
) {
  const wMm = Number(item.width)
  const hLongMm = Number(item.height)
  const hShortMm =
    item.shortSide != null && item.shortSide !== '' ? Number(item.shortSide) : null
  const isTrapezoid = hShortMm != null && hShortMm > 0
  const ilosc = Number(item.ilosc ?? 1)
  const shape = buildShapeCanvas(item, maxDrawW, maxDrawH)

  const dimLabel = isTrapezoid
    ? `${wMm} × ${hLongMm}/${hShortMm} mm`
    : `${wMm} × ${hLongMm} mm`

  const stack = [
    {
      text: `Pozycja ${index + 1}`,
      style: 'drawingTitle',
      margin: [0, 0, 0, 2],
    },
    {
      text: `${item.rodzaj} · ${item.produkt}`,
      fontSize: 9,
      color: '#555',
      margin: [0, 0, 0, 6],
    },
    {
      ...shape,
      alignment: 'center',
    },
    {
      text: `${dimLabel}${ilosc > 1 ? ` · ${ilosc} szt.` : ''}`,
      fontSize: 9,
      alignment: 'center',
      color: '#374151',
      margin: [0, 4, 0, 0],
    },
    {
      text: `Powierzchnia: ${formatAreaM2(item.area)} m²  ·  Dodatek: ${item.dodatek}`,
      fontSize: 8,
      color: '#666',
      margin: [0, 4, 0, 0],
    },
  ]

  if (showPrices) {
    stack.push({
      text:
        item.lineTotalAfterRabat != null && item.lineTotalAfterRabat !== item.lineTotal
          ? {
              columns: [
                { text: `Cena: ${formatMoney(item.lineTotal)}`, fontSize: 9, width: 'auto' },
                greenArrowCanvas(),
                {
                  ...priceAfterRabatText(item.lineTotalAfterRabat),
                  fontSize: 9,
                  width: 'auto',
                },
              ],
              columnGap: 2,
            }
          : `Cena pozycji: ${formatMoney(item.lineTotal)}`,
      fontSize: 9,
      bold: item.lineTotalAfterRabat == null || item.lineTotalAfterRabat === item.lineTotal,
      margin: [0, 2, 0, 0],
    })
  }

  return {
    width: '48%',
    stack,
    margin: [0, 0, 8, marginBottom],
  }
}

function buildDrawingsGrid(
  items,
  { showPrices = true, startIndex = 0, maxDrawW = 130, maxDrawH = 72, marginBottom = 12 } = {}
) {
  const rows = []
  for (let i = 0; i < items.length; i += 2) {
    const drawOpts = { showPrices, maxDrawW, maxDrawH, marginBottom }
    const cols = [buildGlassDrawing(items[i], startIndex + i, drawOpts)]
    if (items[i + 1]) {
      cols.push(buildGlassDrawing(items[i + 1], startIndex + i + 1, drawOpts))
    }
    rows.push({ columns: cols, columnGap: 10 })
  }
  return rows
}

function buildOfferTableBody(items, quote, startLp = 1) {
  const hasRabat = Number(quote.procentRabatu) > 0
  const tableHeader = [
    { text: 'Lp.', style: 'tableHeader' },
    { text: 'Rodzaj', style: 'tableHeader' },
    { text: 'Produkt', style: 'tableHeader' },
    { text: 'Dodatek', style: 'tableHeader' },
    { text: 'Wymiary', style: 'tableHeader' },
    { text: 'Ilość', style: 'tableHeader', alignment: 'right' },
    { text: 'm²', style: 'tableHeader', alignment: 'right' },
    { text: 'Tryb', style: 'tableHeader' },
    { text: 'Cena podst.', style: 'tableHeader', alignment: 'right' },
    ...(hasRabat ? [{ text: 'Po rabacie', style: 'tableHeader', alignment: 'right' }] : []),
  ]

  const tableBody = [
    tableHeader,
    ...items.map((item, i) => [
      String(startLp + i),
      item.rodzaj,
      item.produkt,
      item.dodatek,
      { text: formatDimensions(item.width, item.height, item.shortSide), bold: true },
      { text: String(item.ilosc ?? 1), alignment: 'right', bold: true },
      { text: formatAreaM2(item.area), alignment: 'right' },
      `${item.tryb || ''}${item.procent > 0 ? ` (+${item.procent}%)` : ''}`,
      { text: formatMoney(item.lineTotal), alignment: 'right' },
      ...(hasRabat
        ? [
            {
              text: formatMoney(item.lineTotalAfterRabat ?? item.lineTotal),
              alignment: 'right',
              style: 'priceGreen',
            },
          ]
        : []),
    ]),
  ]

  return {
    hasRabat,
    tableBody,
    widths: hasRabat
      ? [22, 40, '*', 48, 62, 24, 28, 52, 52, 52]
      : [22, 40, '*', 48, 62, 24, 28, 52, 52],
  }
}

function specTableTextCell(text, { bold = false, alignment = 'left' } = {}) {
  return {
    text: String(text ?? ''),
    style: 'specTableCell',
    bold,
    alignment,
    noWrap: true,
  }
}

function buildSpecTableBody(items, startLp = 1) {
  const colCount = 6
  const tableHeader = [
    specTableTextCell('Lp.', { bold: true }),
    specTableTextCell('Produkt', { bold: true }),
    specTableTextCell('Dodatek', { bold: true }),
    specTableTextCell('Wymiary', { bold: true }),
    specTableTextCell('Ilość', { bold: true }),
    specTableTextCell('m²', { bold: true }),
  ]

  tableHeader.forEach((cell) => {
    cell.fillColor = SPEC_TABLE_HEADER_FILL
    cell.color = '#1f2937'
  })

  const tableBody = [tableHeader]

  items.forEach((item, i) => {
    tableBody.push([
      specTableTextCell(startLp + i),
      specTableTextCell(item.produkt),
      specTableTextCell(item.dodatek),
      specTableTextCell(formatDimensions(item.width, item.height, item.shortSide), { bold: true }),
      specTableTextCell(item.ilosc ?? 1, { bold: true }),
      specTableTextCell(formatAreaM2(item.area)),
    ])

    tableBody.push([
      {
        colSpan: colCount,
        stack: [
          buildSquareRowUnderProduct(item.ilosc, { lineColor: SPEC_SQUARE_COLOR }),
        ],
        fillColor: SPEC_SQUARE_ROW_FILL,
      },
      ...emptyColSpanCells(colCount, colCount),
    ])

    tableBody.push([
      {
        colSpan: colCount,
        stack: [CACHED_BLACK_BORDER_FIELD],
        fillColor: '#ffffff',
      },
      ...emptyColSpanCells(colCount, colCount),
    ])
  })

  return {
    tableBody,
    widths: SPEC_TABLE_WIDTHS,
  }
}

function buildSpecPositionsTableBlock(rodzaj, table) {
  return {
    width: SPEC_PAGE_CONTENT_WIDTH,
    stack: [
      buildPozycjeHeader(rodzaj),
      {
        table: {
          headerRows: 1,
          widths: table.widths,
          body: table.tableBody,
        },
        layout: SPEC_TABLE_LAYOUT,
      },
    ],
  }
}

function buildRodzajAreaSummary(items, rodzaj) {
  const totalM2 = sumItemsAreaM2(items)
  return {
    columns: [
      { width: '*', text: '' },
      {
        width: 'auto',
        text: [
          { text: `Łącznie m² (${rodzaj}): `, bold: true },
          { text: `${formatAreaM2(totalM2)} m²`, bold: true, color: '#1e40af' },
        ],
        margin: [0, 6, 0, 4],
        fontSize: 10,
      },
    ],
  }
}

const SUMMARY_TABLE_FONT = 5

function buildRodzajSummaryTable(items) {
  const tableHeader = [
    { text: 'Dodatek', style: 'specSummaryTableHeader' },
    { text: 'Wymiar', style: 'specSummaryTableHeader' },
    { text: 'Ilość', style: 'specSummaryTableHeader', alignment: 'right' },
    { text: 'm²', style: 'specSummaryTableHeader', alignment: 'right' },
  ]

  const tableBody = [
    tableHeader,
    ...items.map((item) => [
      { text: item.dodatek, fontSize: SUMMARY_TABLE_FONT },
      {
        text: formatDimensions(item.width, item.height, item.shortSide),
        fontSize: SUMMARY_TABLE_FONT,
      },
      { text: `${item.ilosc ?? 1} szt`, fontSize: SUMMARY_TABLE_FONT, alignment: 'right' },
      { text: `${formatAreaM2(item.area)} m2`, fontSize: SUMMARY_TABLE_FONT, alignment: 'right' },
    ]),
  ]

  return {
    table: {
      headerRows: 1,
      widths: ['*', '*', 36, 44],
      body: tableBody,
    },
    layout: SPEC_TABLE_LAYOUT,
    margin: [0, 0, 0, 12],
  }
}

function buildSpecRodzajSection(group, table, quote, clientRightColumn, { startIndex, isFirstGroup }) {
  const drawingScale = getDrawingScale(group.items.length)
  const sectionParts = []

  if (isFirstGroup) {
    sectionParts.push(buildSpecFirstPageTopBlock(quote, clientRightColumn))
  } else {
    sectionParts.push({ text: '', pageBreak: 'before' })
    sectionParts.push(buildSpecClientDataBlock(quote, clientRightColumn))
  }

  sectionParts.push(
    buildSpecPositionsTableBlock(group.rodzaj, table),
    buildRodzajDrawingsBlock(group.rodzaj, group.items, {
      showPrices: false,
      startIndex,
      ...drawingScale,
    }),
    buildRodzajAreaSummary(group.items, group.rodzaj),
    buildRodzajSummaryTable(group.items)
  )

  return sectionParts
}

function buildOfferRodzajTableSection(group, table, { isFirstGroup }) {
  return [
    {
      text: `Pozycje oferty: ${group.rodzaj}`,
      style: isFirstGroup ? 'sectionFirst' : 'section',
      pageBreak: isFirstGroup ? undefined : 'before',
    },
    {
      table: {
        headerRows: 1,
        widths: table.widths,
        body: table.tableBody,
      },
      layout: TABLE_LAYOUT,
    },
  ]
}

function buildOfferRodzajDrawingsSection(group, { startIndex }) {
  return [
    buildRodzajDrawingsBlock(group.rodzaj, group.items, {
      showPrices: true,
      startIndex,
    }),
  ]
}

function buildTotalAreaBlock(totalAreaM2) {
  return {
    columns: [
      { width: '*', text: '' },
      {
        width: 220,
        text: [
          { text: 'Łączna powierzchnia: ', bold: true },
          { text: `${formatAreaM2(totalAreaM2)} m²`, bold: true, color: '#1e40af' },
        ],
        alignment: 'right',
        margin: [0, 10, 0, 0],
        fontSize: 10,
      },
    ],
  }
}

function buildPriceSummary(quote, hasRabat) {
  const totalColor = hasRabat ? PRICE_GREEN : '#166534'
  return {
    columns: [
      { width: '*', text: '' },
      {
        width: 220,
        stack: [
          {
            columns: [
              { text: 'Suma pozycji:', width: '*' },
              { text: formatMoney(quote.subtotal), alignment: 'right', width: 80 },
            ],
            margin: [0, 12, 0, 4],
          },
          quote.surcharge > 0
            ? {
                columns: [
                  { text: 'Narzut trybu (łącznie):', width: '*' },
                  { text: `+${formatMoney(quote.surcharge)}`, alignment: 'right', width: 80 },
                ],
                margin: [0, 0, 0, 4],
              }
            : { text: '' },
          quote.discountAmount > 0
            ? {
                columns: [
                  { text: `Rabat (${quote.procentRabatu}%):`, width: '*' },
                  {
                    text: `-${formatMoney(quote.discountAmount)}`,
                    alignment: 'right',
                    width: 80,
                  },
                ],
                margin: [0, 0, 0, 4],
              }
            : { text: '' },
          {
            text: [
              { text: 'RAZEM: ', bold: true, fontSize: 20, color: totalColor },
              {
                text: formatMoney(quote.totalPrice),
                bold: true,
                fontSize: 20,
                color: totalColor,
              },
            ],
            alignment: 'right',
            noWrap: true,
            margin: [0, 4, 0, 0],
          },
        ],
      },
    ],
  }
}

const TABLE_LAYOUT = {
  hLineWidth: () => 0.5,
  vLineWidth: () => 0.5,
  hLineColor: () => '#e2e8f0',
  vLineColor: () => '#e2e8f0',
  paddingLeft: () => 6,
  paddingRight: () => 6,
  paddingTop: () => 5,
  paddingBottom: () => 5,
}

const SPEC_TABLE_LAYOUT = {
  hLineWidth: () => 0.5,
  vLineWidth: () => 0.5,
  hLineColor: () => SPEC_TABLE_LINE,
  vLineColor: () => SPEC_TABLE_LINE,
  paddingLeft: () => 6,
  paddingRight: () => 6,
  paddingTop: () => 5,
  paddingBottom: () => 5,
}

const PDF_STYLES = {
  title: { fontSize: 20, bold: true, color: '#1a1a2e' },
  subtitle: { fontSize: 11, color: '#666', margin: [0, 4, 0, 0] },
  section: { fontSize: 13, bold: true, color: '#1e40af', margin: [0, 16, 0, 8] },
  sectionFirst: { fontSize: 13, bold: true, color: '#1e40af', margin: [0, 10, 0, 8] },
  sectionSub: { fontSize: 11, bold: true, color: '#1e40af', margin: [0, 10, 0, 6] },
  tableHeader: { bold: true, fillColor: '#f1f5f9', fontSize: 9 },
  specTableHeader: { bold: true, fillColor: SPEC_TABLE_HEADER_FILL, color: '#1f2937', fontSize: 9, noWrap: true },
  specTableCell: { fontSize: 9, noWrap: true },
  summaryTableHeader: { bold: true, fillColor: '#f1f5f9', fontSize: SUMMARY_TABLE_FONT },
  specSummaryTableHeader: {
    bold: true,
    fillColor: SPEC_TABLE_HEADER_FILL,
    color: '#1f2937',
    fontSize: SUMMARY_TABLE_FONT,
  },
  priceGreen: { color: PRICE_GREEN, bold: true },
  drawingTitle: { fontSize: 10, bold: true, color: '#1e40af' },
  total: { fontSize: 14, bold: true, color: '#166534' },
  footer: { fontSize: 8, color: '#888' },
}

function buildSpecClientRightColumn(quote, totalAreaM2) {
  return [
    {
      text: [
        { text: 'Tryb realizacji: ', bold: true },
        quote.tryb === 'Różne'
          ? 'różny wg pozycji (patrz tabela)'
          : `${quote.tryb}${quote.procent > 0 ? ` (+${quote.procent}%)` : ''}`,
      ],
    },
    {
      text: [
        { text: 'Łącznie m²: ', bold: true },
        `${formatAreaM2(totalAreaM2)} m²`,
      ],
      margin: [0, 4, 0, 0],
    },
  ]
}

function buildOfferClientRightColumn(quote, totalAreaM2) {
  return [
    {
      text: [
        { text: 'Rabat: ', bold: true },
        quote.procentRabatu > 0 ? `${quote.procentRabatu}%` : 'brak',
      ],
    },
    {
      text: [
        { text: 'Tryb realizacji: ', bold: true },
        quote.tryb === 'Różne'
          ? 'różny wg pozycji (patrz tabela)'
          : `${quote.tryb}${quote.procent > 0 ? ` (+${quote.procent}%)` : ''}`,
      ],
      margin: [0, 4, 0, 0],
    },
    {
      text: [
        { text: 'Łącznie m²: ', bold: true },
        `${formatAreaM2(totalAreaM2)} m²`,
      ],
      margin: [0, 4, 0, 0],
    },
  ]
}

function buildSpecDocDefinition(quote) {
  const totalAreaM2 = sumItemsAreaM2(quote.items)
  const rodzajGroups = groupItemsByRodzaj(quote.items)
  const clientRightColumn = buildSpecClientRightColumn(quote, totalAreaM2)
  const content = []
  let globalLp = 1

  rodzajGroups.forEach((group, groupIndex) => {
    const table = buildSpecTableBody(group.items, globalLp)
    content.push(
      ...buildSpecRodzajSection(group, table, quote, clientRightColumn, {
        startIndex: globalLp - 1,
        isFirstGroup: groupIndex === 0,
      })
    )
    globalLp += group.items.length
  })

  content.push(
    buildTotalAreaBlock(totalAreaM2),
    {
      text: 'Dokument ma charakter informacyjny — specyfikacja wymiarów bez cen.',
      style: 'footer',
      margin: [0, 24, 0, 0],
    }
  )

  return {
    pageSize: 'A4',
    pageMargins: [40, 50, 40, 50],
    defaultStyle: { font: 'Roboto', fontSize: 10 },
    styles: PDF_STYLES,
    content,
  }
}

function buildOfferOnlyDocDefinition(quote) {
  const hasRabat = Number(quote.procentRabatu) > 0
  const totalAreaM2 = sumItemsAreaM2(quote.items)
  const rodzajGroups = groupItemsByRodzaj(quote.items)
  const clientRightColumn = buildOfferClientRightColumn(quote, totalAreaM2)
  const content = [
    ...buildOfferDocHeader(),
    { text: 'Dane klienta', style: 'sectionFirst' },
    {
      columns: [
        {
          width: '*',
          stack: [
            {
              text: [
                { text: 'Firma: ', bold: true },
                { text: quote.companyName, fontSize: CLIENT_NAME_FONT },
              ],
            },
            {
              text: [{ text: 'NIP: ', bold: true }, formatNip(quote.nip)],
              margin: [0, 4, 0, 0],
            },
          ],
        },
        {
          width: '*',
          stack: clientRightColumn,
        },
      ],
    },
  ]

  if (!quote.found) {
    content.push({
      text: 'Uwaga: klient nieznany w bazie — zastosowano rabat domyślny (jeśli ustawiony w arkuszu).',
      fontSize: 9,
      color: '#92400e',
      margin: [0, 8, 0, 0],
    })
  }

  let globalLp = 1
  rodzajGroups.forEach((group, groupIndex) => {
    const table = buildOfferTableBody(group.items, quote, globalLp)
    content.push(
      ...buildOfferRodzajTableSection(group, table, {
        isFirstGroup: groupIndex === 0,
      })
    )
    globalLp += group.items.length
  })

  content.push(buildTotalAreaBlock(totalAreaM2), buildPriceSummary(quote, hasRabat))

  globalLp = 1
  rodzajGroups.forEach((group) => {
    content.push(
      ...buildOfferRodzajDrawingsSection(group, {
        startIndex: globalLp - 1,
      })
    )
    globalLp += group.items.length
  })

  content.push(
    {
      text: 'Oferta ma charakter informacyjny. Ostateczna cena może ulec zmianie po weryfikacji zamówienia.',
      style: 'footer',
      margin: [0, 24, 0, 0],
    }
  )

  return {
    pageSize: 'A4',
    pageMargins: [40, 50, 40, 50],
    defaultStyle: { font: 'Roboto', fontSize: 10 },
    styles: PDF_STYLES,
    content,
  }
}

export function buildOfferDocDefinition(quote, { variant = 'offer' } = {}) {
  if (variant === 'spec') {
    return buildSpecDocDefinition(quote)
  }
  return buildOfferOnlyDocDefinition(quote)
}

export async function getOfferPdfBase64(quote) {
  const pdfMake = await getPdfMake()
  await yieldToMain()
  const docDefinition = buildOfferDocDefinition(quote, { variant: 'offer' })
  return pdfMake.createPdf(docDefinition).getBase64()
}

export async function generateOfferPdf(quote, targetWindow = null) {
  const pdfMake = await getPdfMake()
  await yieldToMain()
  const docDefinition = buildOfferDocDefinition(quote, { variant: 'offer' })
  await yieldToMain()
  await pdfMake.createPdf(docDefinition).open(targetWindow)
}

export async function generateSpecPdf(quote, targetWindow = null) {
  const pdfMake = await getPdfMake()
  await yieldToMain()
  const docDefinition = buildOfferDocDefinition(quote, { variant: 'spec' })
  await yieldToMain()
  await pdfMake.createPdf(docDefinition).open(targetWindow)
}
