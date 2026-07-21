/** Buduje payload zamówienia (nowy format + pola zgodności ze starą wersją API). */
export function buildOrderPayload(quote, { email, telefon }) {
  const items = quote.items ?? []
  const singleItem = items.length === 1 ? items[0] : null
  const totalM2 = items.reduce((sum, item) => sum + Number(item.area || 0), 0)

  return {
    nip: quote.nip,
    nazwa: quote.companyName,
    email,
    telefon,
    cennik: quote.cennik,
    procentRabatu: quote.procentRabatu ?? 0,
    grossTotal: quote.grossTotal ?? quote.subtotal + (quote.surcharge ?? 0),
    discountAmount: quote.discountAmount ?? 0,
    tryb: quote.tryb,
    procentTrybu: quote.procent,
    subtotal: quote.subtotal,
    surcharge: quote.surcharge,
    cenaLaczna: quote.totalPrice,
    items,
    // Stara wersja API (do czasu wdrożenia nowego skryptu)
    rodzaj: singleItem?.rodzaj ?? 'Wiele pozycji',
    produkt: singleItem?.produkt ?? `${items.length} poz.`,
    dodatek: singleItem?.dodatek ?? '',
    m2: totalM2,
  }
}
