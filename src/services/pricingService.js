import { DEFAULT_CENNIK } from '../constants'

export { DEFAULT_CENNIK }
export const DEFAULT_RODZAJ = 'Ogólny'

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'pl')
  )
}

export function normalizeRodzaj(rodzaj) {
  const value = String(rodzaj ?? '').trim()
  return value || DEFAULT_RODZAJ
}

export function normalizeCenniki(cenniki) {
  return (cenniki ?? []).map((c) => ({
    cennik: String(c.cennik ?? '').trim(),
    rodzaj: normalizeRodzaj(c.rodzaj),
    produkt: String(c.produkt ?? '').trim(),
    odM2: Number(c.odM2),
    doM2: Number(c.doM2),
    cena: Number(c.cena),
  }))
}

export function normalizeCatalog(catalog) {
  const cenniki = normalizeCenniki(catalog?.cenniki)
  const dodatki =
    catalog?.dodatki?.length > 0
      ? catalog.dodatki.map((d) => ({
          dodatek: String(d.dodatek ?? '').trim(),
          cena: Number(d.cena) || 0,
        }))
      : [{ dodatek: 'Brak', cena: 0 }]
  const tryby =
    catalog?.tryby?.length > 0
      ? catalog.tryby
      : [{ tryb: 'Standard', procent: 0 }]
  return { cenniki, dodatki, tryby }
}

export function getRodzaje(cenniki) {
  return uniqueSorted(cenniki.map((c) => normalizeRodzaj(c.rodzaj)))
}

export function getProduktyForRodzaj(cenniki, rodzaj) {
  const r = normalizeRodzaj(rodzaj)
  return uniqueSorted(
    cenniki
      .filter((c) => normalizeRodzaj(c.rodzaj) === r)
      .map((c) => c.produkt)
  )
}

export function getDodatkiList(dodatki) {
  return dodatki.map((d) => d.dodatek)
}

export function getDefaultLineValues(cenniki, dodatki) {
  const rodzaj = getRodzaje(cenniki)[0] ?? ''
  const produkt = getProduktyForRodzaj(cenniki, rodzaj)[0] ?? ''
  const dodatek = getDodatkiList(dodatki)[0] ?? ''
  return { rodzaj, produkt, dodatek }
}

/**
 * Stawka za m² (bez dodatku) — dopasowanie zakresu Od/Do m² wg przekazanego areaM2.
 */
export function findProductUnitPrice(cenniki, cennik, rodzaj, produkt, areaM2) {
  const area = Number(areaM2)
  if (isNaN(area) || area <= 0) return null

  const r = normalizeRodzaj(rodzaj)

  const match = (cennikName) =>
    cenniki.find(
      (c) =>
        c.cennik === cennikName &&
        normalizeRodzaj(c.rodzaj) === r &&
        c.produkt === produkt &&
        area >= c.odM2 &&
        area <= c.doM2
    )

  const row = match(cennik) ?? cenniki.find(
    (c) =>
      normalizeRodzaj(c.rodzaj) === r &&
      c.produkt === produkt &&
      area >= c.odM2 &&
      area <= c.doM2
  )

  return row ? row.cena : null
}

/**
 * Stała cena dodatku (ta sama dla wszystkich produktów i rodzajów).
 */
export function findAddonPrice(dodatki, dodatekName) {
  const row = dodatki.find((d) => d.dodatek === dodatekName)
  if (!row) return null
  return Number(row.cena)
}

/**
 * Cena jednej formatki = (stawka za m² × m² formatki) + dodatek.
 * Stawka wybierana wg tierAreaM2 (łączna pow. wiersza: formatka × ilość).
 */
export function calculateLinePrice(
  cenniki,
  dodatki,
  cennik,
  rodzaj,
  produkt,
  dodatek,
  areaPerPieceM2,
  tierAreaM2 = areaPerPieceM2
) {
  const ratePerM2 = findProductUnitPrice(
    cenniki,
    cennik,
    rodzaj,
    produkt,
    tierAreaM2
  )
  if (ratePerM2 === null) return null

  const addonPrice = findAddonPrice(dodatki, dodatek)
  if (addonPrice === null) return null

  return ratePerM2 * Number(areaPerPieceM2) + addonPrice
}

export function getTrybProcent(tryby, trybName) {
  const row = tryby.find((t) => t.tryb === trybName)
  return row ? Number(row.procent) : 0
}
