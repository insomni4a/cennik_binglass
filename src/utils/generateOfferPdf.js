import pdfMake from 'pdfmake/build/pdfmake'
import pdfFonts from 'pdfmake/build/vfs_fonts'
import { formatAreaM2, formatDimensions } from './dimensions'
import { formatNip } from './nipValidation'

pdfMake.addVirtualFileSystem(pdfFonts)

function formatMoney(value) {
  return `${Number(value).toFixed(2)} zł`
}

const PRICE_GREEN = '#047857'

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


/** Rysunek szkła z wymiarami (prostokąt lub trapez przy FIX). */
function buildGlassDrawing(item, index) {
  const wMm = Number(item.width)
  const hLongMm = Number(item.height)
  const hShortMm =
    item.shortSide != null && item.shortSide !== '' ? Number(item.shortSide) : null
  const isTrapezoid = hShortMm != null && hShortMm > 0
  const ilosc = Number(item.ilosc ?? 1)
  const maxDrawW = 130
  const maxDrawH = 75
  const maxHMm = isTrapezoid ? Math.max(hLongMm, hShortMm) : hLongMm
  const scale = Math.min(maxDrawW / wMm, maxDrawH / maxHMm)
  const rectW = Math.max(wMm * scale, 20)
  const rectH = Math.max(maxHMm * scale, 15)
  const pad = 10

  const canvasW = rectW + pad * 2
  const canvasH = rectH + pad * 2

  let shapeCanvas
  if (isTrapezoid) {
    const leftH = hShortMm * scale
    const rightH = hLongMm * scale
    const yBase = pad + rectH
    shapeCanvas = {
      type: 'polyline',
      lineWidth: 1.5,
      lineColor: '#2563eb',
      color: '#eff6ff',
      closePath: true,
      points: [
        { x: pad, y: yBase },
        { x: pad + rectW, y: yBase },
        { x: pad + rectW, y: yBase - rightH },
        { x: pad, y: yBase - leftH },
      ],
    }
  } else {
    shapeCanvas = {
      type: 'rect',
      x: pad,
      y: pad,
      w: rectW,
      h: rectH,
      r: 0,
      lineWidth: 1.5,
      lineColor: '#2563eb',
      color: '#eff6ff',
    }
  }

  const dimLabel = isTrapezoid
    ? `${wMm} × ${hLongMm}/${hShortMm} mm`
    : `${wMm} × ${hLongMm} mm`

  return {
    width: '48%',
    stack: [
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
        canvas: [shapeCanvas],
        width: canvasW,
        height: canvasH,
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
      {
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
      },
    ],
    margin: [0, 0, 8, 14],
  }
}

/** Układa rysunki w rzędach po 2. */
function buildDrawingsGrid(items) {
  const rows = []
  for (let i = 0; i < items.length; i += 2) {
    const cols = [buildGlassDrawing(items[i], i)]
    if (items[i + 1]) {
      cols.push(buildGlassDrawing(items[i + 1], i + 1))
    }
    rows.push({ columns: cols, columnGap: 10 })
  }
  return rows
}

export function buildOfferDocDefinition(quote) {
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
    ...quote.items.map((item, i) => [
      String(i + 1),
      item.rodzaj,
      item.produkt,
      item.dodatek,
      formatDimensions(item.width, item.height, item.shortSide),
      { text: String(item.ilosc ?? 1), alignment: 'right' },
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

  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [40, 50, 40, 50],
    defaultStyle: { font: 'Roboto', fontSize: 10 },
    styles: {
      title: { fontSize: 20, bold: true, color: '#1a1a2e' },
      subtitle: { fontSize: 11, color: '#666', margin: [0, 4, 0, 0] },
      section: { fontSize: 13, bold: true, color: '#1e40af', margin: [0, 16, 0, 8] },
      tableHeader: { bold: true, fillColor: '#f1f5f9', fontSize: 9 },
      priceGreen: { color: PRICE_GREEN, bold: true },
      drawingTitle: { fontSize: 10, bold: true, color: '#1e40af' },
      total: { fontSize: 14, bold: true, color: '#166534' },
      footer: { fontSize: 8, color: '#888', italics: true },
    },
    content: [
      { text: 'Cennik Binglass', style: 'title' },
      { text: 'Oferta / zapytanie ofertowe', style: 'subtitle' },
      { text: `Data wygenerowania: ${formatDate()}`, fontSize: 9, color: '#888', margin: [0, 8, 0, 0] },

      { text: 'Dane klienta', style: 'section' },
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: [{ text: 'Firma: ', bold: true }, quote.companyName] },
              { text: [{ text: 'NIP: ', bold: true }, formatNip(quote.nip)], margin: [0, 4, 0, 0] },
            ],
          },
          {
            width: '*',
            stack: [
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
            ],
          },
        ],
      },

      !quote.found
        ? {
            text: 'Uwaga: klient nieznany w bazie — zastosowano rabat domyślny (jeśli ustawiony w arkuszu).',
            fontSize: 9,
            color: '#92400e',
            margin: [0, 8, 0, 0],
          }
        : { text: '' },

      { text: 'Pozycje oferty', style: 'section' },
      {
        table: {
          headerRows: 1,
          widths: hasRabat
            ? [22, 40, '*', 48, 62, 24, 28, 52, 52, 52]
            : [22, 40, '*', 48, 62, 24, 28, 52, 52],
          body: tableBody,
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#e2e8f0',
          vLineColor: () => '#e2e8f0',
          paddingLeft: () => 6,
          paddingRight: () => 6,
          paddingTop: () => 5,
          paddingBottom: () => 5,
        },
      },

      {
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
                      { text: `-${formatMoney(quote.discountAmount)}`, alignment: 'right', width: 80 },
                    ],
                    margin: [0, 0, 0, 4],
                  }
                : { text: '' },
              {
                columns: [
                  { text: 'RAZEM:', bold: true, width: '*' },
                  {
                    text: formatMoney(quote.totalPrice),
                    alignment: 'right',
                    width: 80,
                    style: hasRabat ? 'priceGreen' : 'total',
                  },
                ],
                margin: [0, 4, 0, 0],
              },
            ],
          },
        ],
      },

      { text: 'Rysunki wymiarowe', style: 'section', pageBreak: quote.items.length > 2 ? 'before' : undefined },
      ...buildDrawingsGrid(quote.items),

      {
        text: 'Oferta ma charakter informacyjny. Ostateczna cena może ulec zmianie po weryfikacji zamówienia.',
        style: 'footer',
        margin: [0, 24, 0, 0],
      },
    ],
  }

  return docDefinition
}

export async function getOfferPdfBase64(quote) {
  const docDefinition = buildOfferDocDefinition(quote)
  return pdfMake.createPdf(docDefinition).getBase64()
}

export async function generateOfferPdf(quote, targetWindow = null) {
  const docDefinition = buildOfferDocDefinition(quote)
  await pdfMake.createPdf(docDefinition).open(targetWindow)
}
