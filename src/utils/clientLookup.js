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

export function applyRabatToLine(lineTotal, procentRabatu) {
  const gross = Number(lineTotal) || 0
  const rabat = Number(procentRabatu) || 0
  const lineDiscount = rabat > 0 ? gross * (rabat / 100) : 0
  return {
    lineDiscount,
    lineTotalAfterRabat: gross - lineDiscount,
  }
}

export function enrichItemsWithRabat(items, procentRabatu) {
  return items.map((item) => {
    const { lineDiscount, lineTotalAfterRabat } = applyRabatToLine(item.lineTotal, procentRabatu)
    return { ...item, lineDiscount, lineTotalAfterRabat }
  })
}

export function applyRabatToTotal(subtotal, surcharge, procentRabatu) {
  const grossTotal = subtotal + surcharge
  const rabat = Number(procentRabatu) || 0
  const discountAmount = rabat > 0 ? grossTotal * (rabat / 100) : 0
  return {
    grossTotal,
    discountAmount,
    totalPrice: grossTotal - discountAmount,
  }
}
