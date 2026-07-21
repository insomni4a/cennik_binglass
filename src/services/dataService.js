import { USE_MOCK, fetchClient, fetchCatalog, submitOrder, isStaleApiResponse } from './api'
import {
  USE_SHEET,
  loadCatalogFromSheet,
  lookupClientFromSheet,
} from './sheetService'
import {
  normalizeCatalog,
  mockFetchClient,
  mockGetCatalog,
  mockSubmitOrder,
} from './pricingService'

export async function loadCatalog() {
  if (USE_MOCK) {
    return { ...mockGetCatalog(), apiStale: false, source: 'mock' }
  }

  if (USE_SHEET) {
    const raw = await loadCatalogFromSheet()
    return {
      ...normalizeCatalog(raw),
      apiStale: false,
      source: 'sheet',
    }
  }

  const raw = await fetchCatalog()
  return {
    ...normalizeCatalog(raw),
    apiStale: isStaleApiResponse(raw),
    source: 'api',
  }
}

export async function lookupClient(nip) {
  if (USE_MOCK) {
    return mockFetchClient(nip)
  }
  if (USE_SHEET) {
    return lookupClientFromSheet(nip)
  }
  return fetchClient(nip)
}

export async function placeOrder(order) {
  if (USE_MOCK) {
    return mockSubmitOrder(order)
  }
  return submitOrder(order)
}

export { USE_MOCK, USE_SHEET }
