/**
 * Cennik Binglass – Google Apps Script API
 * WERSJA: 3  (po wklejeniu szukaj w pliku: API_VERSION = 3)
 *
 * WAŻNE: W projekcie może być tylko JEDNA funkcja doGet!
 * Usuń inne pliki .gs z funkcją doGet, zostaw tylko ten Code.gs.
 */

const SHEET_NAMES = {
  KLIENCI: 'Klienci',
  CENNIKI: 'Cenniki',
  DODATKI: 'Dodatki',
  TRYBY: 'Tryby',
  ZAMOWIENIA: 'Zamówienia',
}

const DEFAULT_CENNIK = 'PODSTAWOWY'
const API_VERSION = 3
const ORDER_NOTIFY_EMAIL = 'kaleb.binglass@gmail.com'

/**
 * GET ?action=client&nip=1234567890
 * GET ?action=cenniki
 */
function doGet(e) {
  try {
    const action = (e.parameter.action || 'client').toLowerCase()

    if (action === 'ping') {
      return jsonResponse({ version: API_VERSION, ok: true })
    }

    if (action === 'cenniki') {
      return jsonResponse({
        version: API_VERSION,
        orderEmail: true,
        cenniki: getCenniki(),
        dodatki: getDodatki(),
        tryby: getTryby(),
      })
    }

    if (action === 'debug') {
      return jsonResponse(getDebugInfo())
    }

    if (action === 'client') {
      const nip = normalizeNip(e.parameter.nip || '')
      if (!nip) {
        return jsonResponse({ error: 'Brak parametru nip' }, 400)
      }
      return jsonResponse(getClientInfo(nip))
    }

    return jsonResponse({ error: 'Nieznana akcja: ' + action }, 400)
  } catch (err) {
    return jsonResponse({ error: String(err.message || err) }, 500)
  }
}

/**
 * POST – body JSON:
 * {
 *   "nip": "1234567890",
 *   "nazwa": "Firma A",
 *   "produkt": "Float 40",
 *   "m2": 15,
 *   "cennik": "A",
 *   "cenaLaczna": 1725
 * }
 */
function doPost(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return jsonResponse({ error: 'Brak danych POST' }, 400)
  }

  try {
    const data = JSON.parse(e.postData.contents)
    validateOrder(data)

    var emailSent = false
    var emailError = ''

    try {
      saveOrder(data)
    } catch (saveErr) {
      throw new Error('Zapis zamówienia: ' + String(saveErr.message || saveErr))
    }

    if (data.email && data.telefon) {
      try {
        sendOrderEmail(data)
        emailSent = true
      } catch (mailErr) {
        emailError = String(mailErr.message || mailErr)
      }
    } else {
      emailError = 'Brak danych do wysyłki e-mail (email lub telefon).'
    }

    return jsonResponse({
      success: true,
      emailSent: emailSent,
      emailError: emailError || null,
      message: emailSent
        ? 'Zamówienie złożone i wysłane e-mailem'
        : 'Zamówienie zapisane, ale e-mail nie został wysłany',
    })
  } catch (err) {
    return jsonResponse({ error: String(err.message || err) }, 400)
  }
}

// --- Klienci ---

function getClientInfo(nip) {
  const sheet = getSheet(SHEET_NAMES.KLIENCI)
  const rows = sheet.getDataRange().getValues()
  const header = rows[0]

  const nipCol = findColumnIndex(header, 'NIP', ['nip'])
  const nazwaCol = findColumnIndex(header, 'Nazwa', ['nazwa', 'Nazwa firmy'])
  const cennikCol = findColumnIndexOptional(header, 'Cennik', ['cennik'])
  const rabatCol = findColumnIndexOptional(header, 'Procent Rabatu', [
    'Procent rabatu',
    'procent rabatu',
    'Rabat',
  ])

  let defaultRabat = 0
  let clientMatch = null

  for (let i = 1; i < rows.length; i++) {
    const rowNip = normalizeNip(String(rows[i][nipCol] || ''))
    const nazwa = String(rows[i][nazwaCol] || '').trim()
    const cennik = cennikCol >= 0 ? String(rows[i][cennikCol] || '').trim() : ''
    const rabatRaw = rabatCol >= 0 ? rows[i][rabatCol] : ''
    const rabat = parseProcentRabatu(rabatRaw)

    if (!rowNip && !nazwa && !cennik && rabat !== null) {
      defaultRabat = rabat
      continue
    }

    if (rowNip === nip) {
      clientMatch = {
        nip: nip,
        nazwa: nazwa || 'Nieznany klient',
        procentRabatu: rabat,
        found: true,
      }
      break
    }
  }

  if (clientMatch) {
    return {
      nip: clientMatch.nip,
      nazwa: clientMatch.nazwa,
      procentRabatu:
        clientMatch.procentRabatu !== null ? clientMatch.procentRabatu : defaultRabat,
      cennik: DEFAULT_CENNIK,
      found: true,
    }
  }

  return {
    nip: nip,
    nazwa: 'Nieznany klient',
    procentRabatu: defaultRabat,
    cennik: DEFAULT_CENNIK,
    found: false,
  }
}

function parseProcentRabatu(value) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return null
  }
  const n = Number(String(value).replace(',', '.').replace('%', ''))
  return isFinite(n) && n >= 0 ? n : null
}

// --- Cenniki ---

function getCenniki() {
  const sheet = getSheet(SHEET_NAMES.CENNIKI)
  const rows = sheet.getDataRange().getValues()
  const header = rows[0]

  const cennikCol = findColumnIndex(header, 'Cennik', ['cennik'])
  const rodzajCol = findColumnIndexOptional(header, 'Rodzaj', ['rodzaj'])
  const produktCol = findColumnIndex(header, 'Produkt', ['produkt'])
  const odCol = findColumnIndex(header, 'Od m²', ['Od m2', 'Od', 'od m2'])
  const doCol = findColumnIndex(header, 'Do m²', ['Do m2', 'Do', 'do m2'])
  const cenaCol = findColumnIndex(header, 'Cena', ['cena'])

  const result = []
  for (let i = 1; i < rows.length; i++) {
    if (!rows[i][cennikCol]) continue
    result.push({
      cennik: String(rows[i][cennikCol]),
      rodzaj: rodzajCol >= 0 ? String(rows[i][rodzajCol] || '') : '',
      produkt: String(rows[i][produktCol]),
      odM2: Number(rows[i][odCol]),
      doM2: Number(rows[i][doCol]),
      cena: Number(rows[i][cenaCol]),
    })
  }
  return result
}

function getDodatki() {
  try {
    const sheet = getSheet(SHEET_NAMES.DODATKI)
    const rows = sheet.getDataRange().getValues()
    const header = rows[0]
    const dodatekCol = findColumnIndex(header, 'Dodatek', ['dodatek'])
    const cenaCol = findColumnIndex(header, 'Cena', ['cena'])

    const result = []
    for (let i = 1; i < rows.length; i++) {
      if (!rows[i][dodatekCol]) continue
      result.push({
        dodatek: String(rows[i][dodatekCol]),
        cena: Number(rows[i][cenaCol]) || 0,
      })
    }
    return result.length > 0 ? result : [{ dodatek: 'Brak', cena: 0 }]
  } catch (err) {
    return [{ dodatek: 'Brak', cena: 0 }]
  }
}

function getTryby() {
  try {
    const sheet = getSheet(SHEET_NAMES.TRYBY)
    const rows = sheet.getDataRange().getValues()
    const header = rows[0]
    const trybCol = findColumnIndex(header, 'Tryb', ['tryb'])
    const procentCol = findColumnIndex(header, 'Procent', ['procent', '%'])

    const result = []
    for (let i = 1; i < rows.length; i++) {
      if (!rows[i][trybCol]) continue
      result.push({
        tryb: String(rows[i][trybCol]),
        procent: Number(rows[i][procentCol]) || 0,
      })
    }
    return result.length > 0 ? result : [{ tryb: 'Standard', procent: 0 }]
  } catch (err) {
    return [{ tryb: 'Standard', procent: 0 }]
  }
}

// --- Debug ---

function getDebugInfo() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  const sheets = ss.getSheets().map((s) => {
    const rows = s.getDataRange().getValues()
    return {
      name: s.getName(),
      rowCount: rows.length,
      headers: rows.length > 0 ? rows[0].map((h) => String(h).trim()) : [],
    }
  })
  return { spreadsheet: ss.getName(), sheets: sheets }
}

// --- Zamówienia ---

function validateOrder(data) {
  if ((!data.items || data.items.length === 0) && data.produkt && data.m2) {
    data.items = [
      {
        rodzaj: String(data.rodzaj || ''),
        produkt: String(data.produkt),
        dodatek: String(data.dodatek || ''),
        width: '',
        height: '',
        area: Number(data.m2),
        lineTotal: Number(data.cenaLaczna || 0),
      },
    ]
  }

  const required = ['nip', 'cennik', 'cenaLaczna']
  for (const field of required) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      throw new Error('Brak wymaganego pola: ' + field)
    }
  }

  if (!data.nazwa) {
    data.nazwa = 'Nieznany klient'
  }

  if (!Array.isArray(data.items) || data.items.length === 0) {
    throw new Error('Brak pozycji zamówienia')
  }

  const hasNewOrderFlow = Boolean(data.email && data.telefon)
  if (hasNewOrderFlow) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.email).trim())) {
      throw new Error('Nieprawidłowy adres e-mail')
    }

    const phoneDigits = String(data.telefon).replace(/\D/g, '')
    if (phoneDigits.length < 9) {
      throw new Error('Nieprawidłowy numer telefonu')
    }
  }
}

function getOrderItemsSummary(items) {
  if (!items || items.length === 0) return { rodzaj: '', produkt: '', dodatek: '', m2: 0 }

  if (items.length === 1) {
    const item = items[0]
    return {
      rodzaj: String(item.rodzaj || ''),
      produkt: String(item.produkt || ''),
      dodatek: String(item.dodatek || ''),
      m2: Number(item.area || item.m2 || 0),
    }
  }

  const totalM2 = items.reduce(function (sum, item) {
    return sum + Number(item.area || item.m2 || 0)
  }, 0)

  return {
    rodzaj: 'Wiele pozycji',
    produkt: items.length + ' poz.',
    dodatek: '',
    m2: totalM2,
  }
}

function saveOrder(data) {
  const sheet = getSheet(SHEET_NAMES.ZAMOWIENIA)
  const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss')
  const summary = getOrderItemsSummary(data.items)

  sheet.appendRow([
    now,
    normalizeNip(String(data.nip)),
    String(data.nazwa || 'Nieznany klient'),
    summary.rodzaj,
    summary.produkt,
    summary.dodatek,
    String(data.tryb || ''),
    Number(data.procentTrybu || 0),
    summary.m2,
    String(data.cennik),
    Number(data.cenaLaczna),
    String(data.email || ''),
    String(data.telefon || ''),
    JSON.stringify(data.items || []),
  ])
}

function sendOrderEmail(data) {
  const lines = (data.items || []).map(function (item, index) {
    const area = Number(item.area || item.m2 || 0)
    const price = Number(item.lineTotal || item.cena || 0)
    const qty = Number(item.ilosc || 1)
    return (
      index +
      1 +
      '. ' +
      item.rodzaj +
      ' / ' +
      item.produkt +
      ' / ' +
      item.dodatek +
      ' — ' +
      item.width +
      '×' +
      item.height +
      ' mm × ' +
      qty +
      ' szt. (' +
      area +
      ' m²) — ' +
      price.toFixed(2) +
      ' zł'
    )
  })

  const body =
    'Nowe zamówienie z kalkulatora Cennik Binglass\n\n' +
    'Firma: ' +
    data.nazwa +
    '\n' +
    'NIP: ' +
    normalizeNip(String(data.nip)) +
    '\n' +
    'E-mail klienta: ' +
    data.email +
    '\n' +
    'Telefon klienta: ' +
    data.telefon +
    '\n' +
    (Number(data.procentRabatu || 0) > 0 ? 'Rabat: ' + data.procentRabatu + '%\n' : '') +
    'Cennik: ' +
    data.cennik +
    '\n' +
    'Tryb: ' +
    (data.tryb || '') +
    (Number(data.procentTrybu || 0) > 0 ? ' (+' + data.procentTrybu + '%)' : '') +
    '\n\n' +
    'Pozycje:\n' +
    lines.join('\n') +
    '\n\n' +
    'Suma pozycji: ' +
    Number(data.subtotal || data.cenaLaczna).toFixed(2) +
    ' zł\n' +
    (Number(data.procentTrybu || 0) > 0
      ? 'Narzut trybu: +' + Number(data.surcharge || 0).toFixed(2) + ' zł\n'
      : '') +
    (Number(data.discountAmount || 0) > 0
      ? 'Rabat (' + data.procentRabatu + '%): -' + Number(data.discountAmount).toFixed(2) + ' zł\n'
      : '') +
    'RAZEM: ' +
    Number(data.cenaLaczna).toFixed(2) +
    ' zł'

  MailApp.sendEmail({
    to: ORDER_NOTIFY_EMAIL,
    subject: 'Nowe zamówienie Binglass: ' + data.nazwa,
    body: body,
  })
}

// --- Pomocnicze ---

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  const sheet = ss.getSheetByName(name)
  if (!sheet) {
    throw new Error('Brak arkusza: ' + name)
  }
  return sheet
}

function findColumnIndexOptional(header, name, aliases) {
  const targets = [name].concat(aliases || []).map(normalizeHeader)
  return header.findIndex((h) => targets.includes(normalizeHeader(h)))
}

function findColumnIndex(header, name, aliases) {
  const targets = [name].concat(aliases || []).map(normalizeHeader)
  const idx = header.findIndex((h) => targets.includes(normalizeHeader(h)))
  if (idx === -1) {
    const found = header.map((h) => String(h).trim()).filter(Boolean).join(', ')
    throw new Error('Brak kolumny: ' + name + '. Znalezione nagłówki: [' + found + ']')
  }
  return idx
}

function normalizeHeader(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/m²/g, 'm2')
    .replace(/\s+/g, ' ')
}

function normalizeNip(nip) {
  return String(nip).replace(/\D/g, '')
}

/**
 * Uruchom tę funkcję w edytorze Apps Script (▶ Wykonaj), żeby sprawdzić dane z arkusza.
 * Wynik zobaczysz w: Wykonaj → dziennik wykonania.
 */
function testDeploy() {
  const info = {
    apiVersion: API_VERSION,
    cenniki: getCenniki(),
    dodatki: getDodatki(),
    tryby: getTryby(),
  }
  Logger.log(JSON.stringify(info, null, 2))
  return info
}

function testSendOrderEmail() {
  sendOrderEmail({
    nip: '1234567890',
    nazwa: 'Test Binglass',
    email: 'test@example.com',
    telefon: '123456789',
    cennik: 'Pierwszy',
    tryb: 'Normalny',
    procentTrybu: 0,
    subtotal: 100,
    surcharge: 0,
    cenaLaczna: 100,
    items: [
      {
        rodzaj: 'VSG',
        produkt: '44.2 Float',
        dodatek: 'Brak',
        width: 1000,
        height: 1000,
        ilosc: 1,
        area: 1,
        lineTotal: 100,
      },
    ],
  })
}

function jsonResponse(data, statusCode) {
  const output = ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON)

  // Apps Script Web App nie obsługuje kodów HTTP bezpośrednio,
  // ale możemy dodać pole status w JSON przy błędach.
  if (statusCode && statusCode >= 400) {
    return ContentService.createTextOutput(
      JSON.stringify({ ...data, status: statusCode })
    ).setMimeType(ContentService.MimeType.JSON)
  }

  return output
}
