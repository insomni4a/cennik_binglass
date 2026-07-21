/** Wymiary podawane w milimetrach (standard dla szkła). */
export function calcAreaM2(widthMm, heightMm) {
  const w = Number(widthMm)
  const h = Number(heightMm)
  if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) return null
  return (w / 1000) * (h / 1000)
}

export function normalizeIlosc(value) {
  if (value === '' || value === undefined || value === null) return 1
  const n = Number(value)
  if (!Number.isInteger(n) || n < 1) return null
  return n
}

export function calcLineAreaM2(widthMm, heightMm, ilosc = 1) {
  const areaPerPiece = calcAreaM2(widthMm, heightMm)
  const qty = normalizeIlosc(ilosc)
  if (areaPerPiece === null || qty === null) return null
  return areaPerPiece * qty
}

export function formatDimensions(widthMm, heightMm) {
  const w = Number(widthMm)
  const h = Number(heightMm)
  if (!w || !h) return ''
  return `${w} × ${h} mm`
}

export function formatAreaM2(area) {
  if (area == null || isNaN(area)) return ''
  return parseFloat(Number(area).toFixed(2)).toString()
}
