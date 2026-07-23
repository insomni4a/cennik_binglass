/** Wymiary podawane w milimetrach (standard dla szkła). */

const SHORT_SIDE_DODATKI = new Set([
  'fix + zatępienie',
  'fix + zatepienie',
  'fix + szlif',
])

export function needsShortSide(dodatek) {
  const key = String(dodatek || '').trim().toLowerCase()
  return SHORT_SIDE_DODATKI.has(key)
}

export function calcAreaM2(widthMm, heightMm) {
  const w = Number(widthMm)
  const h = Number(heightMm)
  if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) return null
  return (w / 1000) * (h / 1000)
}

/** Trapez: szerokość dolna × średnia z wysokości długiej (prawy bok) i krótkiej (lewy bok). */
export function calcTrapezoidAreaM2(widthMm, heightLongMm, heightShortMm) {
  const w = Number(widthMm)
  const hLong = Number(heightLongMm)
  const hShort = Number(heightShortMm)
  if (isNaN(w) || isNaN(hLong) || isNaN(hShort) || w <= 0 || hLong <= 0 || hShort <= 0) {
    return null
  }
  return ((hLong + hShort) / 2) * (w / 1_000_000)
}

export function calcAreaPerPieceM2(widthMm, heightMm, shortSideMm = null) {
  if (shortSideMm != null && shortSideMm !== '') {
    return calcTrapezoidAreaM2(widthMm, heightMm, shortSideMm)
  }
  return calcAreaM2(widthMm, heightMm)
}

export function normalizeIlosc(value) {
  if (value === '' || value === undefined || value === null) return 1
  const n = Number(value)
  if (!Number.isInteger(n) || n < 1) return null
  return n
}

export function calcLineAreaM2(widthMm, heightMm, ilosc = 1, shortSideMm = null) {
  const areaPerPiece = calcAreaPerPieceM2(widthMm, heightMm, shortSideMm)
  const qty = normalizeIlosc(ilosc)
  if (areaPerPiece === null || qty === null) return null
  return areaPerPiece * qty
}

export function formatDimensions(widthMm, heightMm, shortSideMm = null) {
  const w = Number(widthMm)
  const h = Number(heightMm)
  if (!w || !h) return ''
  const short = Number(shortSideMm)
  if (shortSideMm != null && shortSideMm !== '' && short > 0) {
    return `${w} × ${h}/${short} mm`
  }
  return `${w} × ${h} mm`
}

export function formatAreaM2(area) {
  if (area == null || isNaN(area)) return ''
  return parseFloat(Number(area).toFixed(2)).toString()
}
