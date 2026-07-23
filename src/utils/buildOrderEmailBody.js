import { formatAreaM2, formatDimensions } from './dimensions'
import { formatNip } from './nipValidation'

export const ORDER_NOTIFY_EMAIL = 'kaleb.binglass@gmail.com'

export function buildOrderEmailBody(order) {
  const lines = (order.items || []).map((item, index) => {
    const area = Number(item.area || 0)
    const qty = item.ilosc ?? 1
    const trybInfo = item.tryb
      ? ` · ${item.tryb}${item.procent > 0 ? ` (+${item.procent}%)` : ''}`
      : ''
    const priceBase = Number(item.lineTotal || 0)
    const priceAfter = Number(item.lineTotalAfterRabat ?? priceBase)
    const priceText =
      priceAfter !== priceBase
        ? `${priceBase.toFixed(2)} zł → ${priceAfter.toFixed(2)} zł`
        : `${priceBase.toFixed(2)} zł`
    return `${index + 1}. ${item.rodzaj} / ${item.produkt} / ${item.dodatek} — ${formatDimensions(item.width, item.height, item.shortSide)} × ${qty} szt. (${formatAreaM2(area)} m²)${trybInfo} — ${priceText}`
  })

  return (
    `Nowe zamówienie z kalkulatora Cennik Binglass\n\n` +
    `Firma: ${order.nazwa}\n` +
    `NIP: ${formatNip(order.nip)}\n` +
    `E-mail klienta: ${order.email}\n` +
    `Telefon klienta: ${order.telefon}\n` +
    (Number(order.procentRabatu || 0) > 0 ? `Rabat: ${order.procentRabatu}%\n` : '') +
    `Cennik: ${order.cennik}\n\n` +
    `Pozycje:\n${lines.join('\n')}\n\n` +
    `Suma pozycji: ${Number(order.subtotal || order.cenaLaczna).toFixed(2)} zł\n` +
    (Number(order.procentTrybu || 0) > 0 || Number(order.surcharge || 0) > 0
      ? `Narzut trybu: +${Number(order.surcharge || 0).toFixed(2)} zł\n`
      : '') +
    (Number(order.discountAmount || 0) > 0
      ? `Rabat (${order.procentRabatu}%): -${Number(order.discountAmount).toFixed(2)} zł\n`
      : '') +
    `RAZEM: ${Number(order.cenaLaczna).toFixed(2)} zł`
  )
}

export function buildOrderEmailSubject(order) {
  return `Nowe zamówienie Binglass: ${order.nazwa}`
}
