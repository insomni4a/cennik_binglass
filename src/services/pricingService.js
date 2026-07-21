import mockData from '../data/mockData.json'
import { DEFAULT_CENNIK } from '../constants'
import { parseKlienciRows, resolveClientFromKlienci } from '../utils/clientLookup'

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
 * Cena za m² produktu (bez dodatku) — zależy od cennika klienta, rodzaju, produktu i zakresu m².
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
 * Cena pozycji = (cena produktu za m² × m²) + cena dodatku
 */
export function calculateLinePrice(
  cenniki,
  dodatki,
  cennik,
  rodzaj,
  produkt,
  dodatek,
  areaM2
) {
  const unitPrice = findProductUnitPrice(cenniki, cennik, rodzaj, produkt, areaM2)
  if (unitPrice === null) return null

  const addonPrice = findAddonPrice(dodatki, dodatek)
  if (addonPrice === null) return null

  return unitPrice * Number(areaM2) + addonPrice
}

export function getTrybProcent(tryby, trybName) {
  const row = tryby.find((t) => t.tryb === trybName)
  return row ? Number(row.procent) : 0
}

export function calculateOrderTotal(subtotal, tryby, trybName) {
  const procent = getTrybProcent(tryby, trybName)
  const surcharge = subtotal * (procent / 100)
  return {
    subtotal,
    tryb: trybName,
    procent,
    surcharge,
    total: subtotal + surcharge,
  }
}

export function distributeTrybToLines(lineTotals, orderTotal) {
  const subtotal = lineTotals.reduce((sum, v) => sum + v, 0)
  if (subtotal === 0) return lineTotals.map(() => 0)
  return lineTotals.map((line) => (line / subtotal) * orderTotal.total)
}

// --- Mock (offline) ---

export function mockFindClientByNip(nip) {
  const col = (row, ...names) => {
    for (const name of names) {
      if (row[name] !== undefined && row[name] !== '') return row[name]
    }
    return ''
  }
  const parsed = parseKlienciRows(mockData.klienci, col)
  return resolveClientFromKlienci(nip, parsed)
}

export function mockGetCatalog() {
  return normalizeCatalog({
    version: 2,
    cenniki: mockData.cenniki,
    dodatki: mockData.dodatki,
    tryby: mockData.tryby,
  })
}

export async function mockFetchClient(nip) {
  const client = mockFindClientByNip(nip)
  return { ...client, cennik: DEFAULT_CENNIK }
}

export async function mockSubmitOrder(order) {
  await new Promise((r) => setTimeout(r, 500))
  console.info('Mock zamówienie:', order)
  return { success: true, emailSent: false, message: 'Zamówienie zapisane (mock)' }
}
