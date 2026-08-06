function isEmpty(value) {
  return String(value ?? '').trim() === ''
}

export function parseProcentRabatu(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null
  const n = Number(String(value).replace(',', '.').replace('%', ''))
  return Number.isFinite(n) && n >= 0 ? n : null
}

/**
 * Parsuje wiersze arkusza Klienci.
 * Wiersz z pustym NIP, Nazwa i Cennik + wartością Procent Rabatu = rabat domyślny.
 */
export function parseKlienciRows(rows, col) {
  let defaultRabat = 0
  const byNip = new Map()

  for (const row of rows) {
    const nip = String(col(row, 'NIP', 'nip')).replace(/\D/g, '')
    const nazwa = col(row, 'Nazwa', 'nazwa', 'Nazwa firmy')
    const cennik = col(row, 'Cennik', 'cennik')
    const rabat = parseProcentRabatu(
      col(row, 'Procent Rabatu', 'Procent rabatu', 'procent rabatu', 'procentRabatu', 'Rabat')
    )

    if (isEmpty(nip) && isEmpty(nazwa) && isEmpty(cennik) && rabat !== null) {
      defaultRabat = rabat
      continue
    }

    if (nip) {
      byNip.set(nip, {
        nip,
        nazwa: nazwa || 'Nieznany klient',
        procentRabatu: rabat,
        found: true,
      })
    }
  }

  return { defaultRabat, byNip }
}

export function resolveClientFromKlienci(nip, parsed) {
  const normalized = String(nip).replace(/\D/g, '')
  const client = parsed.byNip.get(normalized)

  if (client) {
    return {
      nip: normalized,
      nazwa: client.nazwa,
      procentRabatu: client.procentRabatu !== null ? client.procentRabatu : parsed.defaultRabat,
      found: true,
    }
  }

  return {
    nip: normalized,
    nazwa: 'Nieznany klient',
    procentRabatu: parsed.defaultRabat,
    found: false,
  }
}

export function parseOrderHistoryFromRows(rows, nip, colFn) {
  const normalized = String(nip).replace(/\D/g, '')
  let orderCount = 0
  let lastEmail = ''
  let lastTelefon = ''
  let lastRowIndex = -1

  rows.forEach((row, index) => {
    const rowNip = String(colFn(row, 'NIP', 'nip')).replace(/\D/g, '')
    if (rowNip !== normalized) return

    orderCount++
    if (index >= lastRowIndex) {
      lastRowIndex = index
      const email = String(colFn(row, 'E-mail', 'Email', 'email')).trim()
      const telefon = String(colFn(row, 'Telefon', 'telefon', 'Phone')).trim()
      if (email) lastEmail = email
      if (telefon) lastTelefon = telefon
    }
  })

  return { orderCount, lastEmail, lastTelefon }
}

export function enrichClientProfile(client, history = {}) {
  const orderCount = Number(history.orderCount ?? client.orderCount) || 0
  const found = Boolean(client.found)
  const hasOrders = orderCount > 0 || Boolean(client.hasOrders)
  return {
    ...client,
    orderCount,
    found,
    hasOrders,
    lastEmail: history.lastEmail ?? client.lastEmail ?? '',
    lastTelefon: history.lastTelefon ?? client.lastTelefon ?? '',
  }
}

export function applyRabatToLine(lineSubtotal, lineSurcharge, procentRabatu) {
  const subtotal = Number(lineSubtotal) || 0
  const surcharge = Number(lineSurcharge) || 0
  const rabat = Number(procentRabatu) || 0
  const lineDiscount = rabat > 0 ? subtotal * (rabat / 100) : 0
  const lineSubtotalAfterRabat = subtotal - lineDiscount

  return {
    lineDiscount,
    lineSubtotalAfterRabat,
    lineTotalAfterRabat: lineSubtotalAfterRabat + surcharge,
  }
}

export function enrichItemsWithRabat(items, procentRabatu) {
  return items.map((item) => {
    const { lineDiscount, lineSubtotalAfterRabat, lineTotalAfterRabat } = applyRabatToLine(
      item.lineSubtotal,
      item.lineSurcharge,
      procentRabatu
    )
    return { ...item, lineDiscount, lineSubtotalAfterRabat, lineTotalAfterRabat }
  })
}

export function applyRabatToTotal(subtotal, surcharge, procentRabatu) {
  const baseSubtotal = Number(subtotal) || 0
  const modeSurcharge = Number(surcharge) || 0
  const rabat = Number(procentRabatu) || 0
  const discountAmount = rabat > 0 ? baseSubtotal * (rabat / 100) : 0
  const subtotalAfterRabat = baseSubtotal - discountAmount

  return {
    grossTotal: baseSubtotal + modeSurcharge,
    subtotalAfterRabat,
    discountAmount,
    totalPrice: subtotalAfterRabat + modeSurcharge,
  }
}

export function resolveClientFromKlienciRows(klienciRows, nip, colFn, { cennik = 'PODSTAWOWY' } = {}) {
  if (!klienciRows?.length) return null
  const parsed = parseKlienciRows(klienciRows, colFn)
  const client = resolveClientFromKlienci(nip, parsed)
  return enrichClientProfile({ ...client, cennik })
}
