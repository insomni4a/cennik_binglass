import mockData from '../data/mockData.json'
import { DEFAULT_CENNIK } from '../constants'
import { parseKlienciRows, resolveClientFromKlienci } from '../utils/clientLookup'
import { normalizeCatalog } from './pricingService'

function mockCol(row, ...names) {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== '') return row[name]
  }
  return ''
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
  const parsed = parseKlienciRows(mockData.klienci, mockCol)
  const client = resolveClientFromKlienci(nip, parsed)
  return { ...client, cennik: DEFAULT_CENNIK }
}

export async function mockSubmitOrder(order) {
  await new Promise((r) => setTimeout(r, 500))
  console.info('Mock zamówienie:', order)
  return { success: true, emailSent: false, message: 'Zamówienie zapisane (mock)' }
}
