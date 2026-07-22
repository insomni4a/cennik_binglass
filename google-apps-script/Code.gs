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
const NEW_CLIENT_FROM_ORDER_CENNIK = 'podstawowy'
const NEW_CLIENT_FROM_ORDER_RABAT = 25
const API_VERSION = 3
const ORDER_NOTIFY_EMAIL = 'kaleb.binglass@gmail.com'
const BINGLASS_MAIL_FROM = 'kaleb.binglass@gmail.com'
const BINGLASS_MAIL_NAME = 'Binglass'

/**
 * GET ?action=client&nip=1234567890
 * GET ?action=cenniki
 */
function doGet(e) {
  try {
    const action = (e.parameter.action || 'client').toLowerCase()

    if (action === 'ping') {
      return jsonResponse({
        version: API_VERSION,
        ok: true,
        clientRegisterOnOrder: true,
      })
    }

    if (action === 'cenniki') {
      return jsonResponse({
        version: API_VERSION,
        orderEmail: true,
        clientRegisterOnOrder: true,
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
    var customerEmailSent = false
    var customerEmailError = ''

    var clientAdded = false
    var clientRegisterError = null
    var clientRegisterReason = null
    var clientRegisterRow = null

    try {
      var registerResult = saveOrder(data)
      clientAdded = Boolean(registerResult.added)
      clientRegisterReason = registerResult.reason || null
      clientRegisterRow = registerResult.row || null
      clientRegisterError = registerResult.error || null
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
      emailError = 'Brak danych do wysyłki powiadomienia (e-mail lub telefon).'
    }

    var customerEmailWarning = null
    if (data.email) {
      try {
        var customerMailResult = sendCustomerConfirmationEmail(data)
        customerEmailSent = true
        customerEmailWarning = customerMailResult.sameMailboxWarning || null
      } catch (customerMailErr) {
        customerEmailError = String(customerMailErr.message || customerMailErr)
      }
    }

    return jsonResponse({
      success: true,
      emailSent: emailSent,
      customerEmailSent: customerEmailSent,
      customerEmailWarning: customerEmailWarning,
      clientAdded: clientAdded,
      clientRegisterReason: clientRegisterReason,
      clientRegisterRow: clientRegisterRow,
      clientRegisterError: clientRegisterError || null,
      emailError: emailError || null,
      customerEmailError: customerEmailError || null,
      message: emailSent
        ? 'Zamówienie złożone i wysłane e-mailem'
        : customerEmailSent
          ? 'Zamówienie zapisane — wysłano potwierdzenie do klienta'
          : 'Zamówienie zapisane, ale e-mail nie został wysłany',
    })
  } catch (err) {
    return jsonResponse({ error: String(err.message || err) }, 400)
  }
}

// --- Klienci ---

function withOrderHistory(clientInfo) {
  var history = getOrderHistoryForNip(clientInfo.nip)
  return {
    nip: clientInfo.nip,
    nazwa: clientInfo.nazwa,
    procentRabatu: clientInfo.procentRabatu,
    cennik: clientInfo.cennik,
    found: clientInfo.found,
    orderCount: history.orderCount,
    hasOrders: history.orderCount > 0,
    lastEmail: history.lastEmail,
    lastTelefon: history.lastTelefon,
  }
}

function getOrderHistoryForNip(nip) {
  try {
    const sheet = getSheet(SHEET_NAMES.ZAMOWIENIA)
    const rows = sheet.getDataRange().getValues()
    if (rows.length < 2) {
      return { orderCount: 0, lastEmail: '', lastTelefon: '' }
    }

    const header = rows[0]
    const nipCol = findColumnIndexOptional(header, 'NIP', ['nip'])
    if (nipCol < 0) {
      return { orderCount: 0, lastEmail: '', lastTelefon: '' }
    }

    const emailCol = findColumnIndexOptional(header, 'E-mail', ['Email', 'email'])
    const phoneCol = findColumnIndexOptional(header, 'Telefon', ['telefon', 'Phone'])

    var orderCount = 0
    var lastEmail = ''
    var lastTelefon = ''
    var lastIndex = -1

    for (var i = 1; i < rows.length; i++) {
      if (normalizeNip(String(rows[i][nipCol] || '')) !== nip) continue
      orderCount++
      if (i >= lastIndex) {
        lastIndex = i
        if (emailCol >= 0) {
          const email = String(rows[i][emailCol] || '').trim()
          if (email) lastEmail = email
        }
        if (phoneCol >= 0) {
          const telefon = String(rows[i][phoneCol] || '').trim()
          if (telefon) lastTelefon = telefon
        }
      }
    }

    return { orderCount: orderCount, lastEmail: lastEmail, lastTelefon: lastTelefon }
  } catch (err) {
    return { orderCount: 0, lastEmail: '', lastTelefon: '' }
  }
}

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
    return withOrderHistory({
      nip: clientMatch.nip,
      nazwa: clientMatch.nazwa,
      procentRabatu:
        clientMatch.procentRabatu !== null ? clientMatch.procentRabatu : defaultRabat,
      cennik: DEFAULT_CENNIK,
      found: true,
    })
  }

  return withOrderHistory({
    nip: nip,
    nazwa: 'Nieznany klient',
    procentRabatu: defaultRabat,
    cennik: DEFAULT_CENNIK,
    found: false,
  })
}

/**
 * Po pierwszym zamówieniu dopisuje klienta do arkusza Klienci (jeśli NIP nie istnieje).
 * Zakładka: NIP | Nazwa | Cennik | Procent Rabatu (kolumny A–D).
 */
function ensureClientRegisteredFromOrder(data) {
  const nip = normalizeNip(String(data.nip || ''))
  if (!nip) {
    return { added: false, reason: 'no_nip' }
  }

  const sheet = getSheet(SHEET_NAMES.KLIENCI)

  if (sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET).length > 0) {
    throw new Error(
      'Arkusz Klienci jest chroniony. Usuń ochronę arkusza lub pozwól właścicielowi skryptu na edycję.'
    )
  }

  ensureKlienciHeaderRow(sheet)

  const lastRow = sheet.getLastRow()
  if (lastRow > 1) {
    const existing = sheet.getRange(2, 1, lastRow, 1).getValues()
    for (let i = 0; i < existing.length; i++) {
      if (normalizeNip(String(existing[i][0] || '')) === nip) {
        return { added: false, reason: 'exists', nip: nip }
      }
    }
  }

  const nazwa = String(data.nazwa || '').trim() || 'Nieznany klient'
  sheet.appendRow([nip, nazwa, NEW_CLIENT_FROM_ORDER_CENNIK, NEW_CLIENT_FROM_ORDER_RABAT])
  const writtenRow = sheet.getLastRow()
  sheet.getRange(writtenRow, 1).setNumberFormat('@')
  SpreadsheetApp.flush()

  return { added: true, reason: 'added', row: writtenRow, nip: nip, nazwa: nazwa }
}

function ensureKlienciHeaderRow(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, 4).setValues([['NIP', 'Nazwa', 'Cennik', 'Procent Rabatu']])
    return
  }

  const firstHeader = String(sheet.getRange(1, 1).getValue() || '').trim()
  if (normalizeHeader(firstHeader) !== 'nip') {
    sheet.insertRowBefore(1)
    sheet.getRange(1, 1, 1, 4).setValues([['NIP', 'Nazwa', 'Cennik', 'Procent Rabatu']])
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
      lastRow: s.getLastRow(),
      protected: s.getProtections(SpreadsheetApp.ProtectionType.SHEET).length > 0,
      headers: rows.length > 0 ? rows[0].map((h) => String(h).trim()) : [],
    }
  })

  let klienciSample = []
  try {
    const klienci = getSheet(SHEET_NAMES.KLIENCI)
    const lastRow = klienci.getLastRow()
    if (lastRow > 1) {
      klienciSample = klienci.getRange(2, 1, Math.min(lastRow, 6), 4).getValues()
    }
  } catch (err) {
    klienciSample = [{ error: String(err.message || err) }]
  }

  return {
    apiVersion: API_VERSION,
    clientRegisterOnOrder: true,
    spreadsheet: ss.getName(),
    sheets: sheets,
    klienciSample: klienciSample,
  }
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

  try {
    return ensureClientRegisteredFromOrder(data)
  } catch (registerErr) {
    return {
      added: false,
      reason: 'error',
      error: String(registerErr.message || registerErr),
    }
  }
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

  sendBinglassEmail(ORDER_NOTIFY_EMAIL, 'Nowe zamówienie Binglass: ' + data.nazwa, body)
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

function getScriptMailbox() {
  try {
    var active = Session.getActiveUser().getEmail()
    if (active) return normalizeEmail(active)
  } catch (err) {}

  try {
    var effective = Session.getEffectiveUser().getEmail()
    if (effective) return normalizeEmail(effective)
  } catch (err) {}

  return ''
}

/**
 * Wysyła e-mail jako Binglass. Próbuje GmailApp z adresem FROM (wymaga aliasu „Wyślij jako”),
 * w razie błędu używa MailApp (nadawca = konto właściciela skryptu).
 */
function sendBinglassEmail(recipient, subject, body) {
  var to = String(recipient || '').trim()
  if (!to) {
    throw new Error('Brak adresu odbiorcy e-mail')
  }

  var mailOptions = {
    name: BINGLASS_MAIL_NAME,
    replyTo: ORDER_NOTIFY_EMAIL,
  }

  var senderMailbox = getScriptMailbox()
  var sameMailbox = Boolean(senderMailbox && normalizeEmail(to) === senderMailbox)

  try {
    GmailApp.sendEmail(
      to,
      subject,
      body,
      Object.assign({}, mailOptions, { from: BINGLASS_MAIL_FROM })
    )
  } catch (gmailErr) {
    MailApp.sendEmail(
      Object.assign(
        {
          to: to,
          subject: subject,
          body: body,
        },
        mailOptions
      )
    )
  }

  return {
    sameMailboxWarning: sameMailbox
      ? 'Adres klienta jest taki sam jak konto wysyłające skrypt — wiadomość może nie trafić do Odebranych (sprawdź folder Wysłane).'
      : null,
  }
}

function sendCustomerConfirmationEmail(data) {
  const email = String(data.email || '').trim()
  if (!email) {
    throw new Error('Brak adresu e-mail klienta')
  }

  const body =
    'Dzień dobry,\n\n' +
    'dziękujemy za zamówienie w Binglass.\n' +
    'Skontaktujemy się jak najszybciej i przystąpimy do realizacji.\n\n' +
    'Pozdrawiamy,\n' +
    'Zespół Binglass\n\n' +
    '---\n' +
    'To jest automatyczna wiadomość potwierdzająca przyjęcie zamówienia.'

  return sendBinglassEmail(
    email,
    'Potwierdzenie zamówienia — Binglass',
    body
  )
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

function testRegisterClientFromOrder() {
  return ensureClientRegisteredFromOrder({
    nip: '9999999999',
    nazwa: 'Test automatyczny Klienci',
  })
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
