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
import { enrichClientProfile } from '../utils/clientLookup'

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
    return enrichClientProfile(await mockFetchClient(nip))
  }

  if (import.meta.env.VITE_API_URL) {
    try {
      return enrichClientProfile(await fetchClient(nip))
    } catch (err) {
      if (USE_SHEET) {
        return lookupClientFromSheet(nip)
      }
      throw err
    }
  }

  if (USE_SHEET) {
    return lookupClientFromSheet(nip)
  }

  throw new Error('Brak źródła danych klienta (API lub arkusz).')
}

export async function placeOrder(order) {
  if (USE_MOCK) {
    return mockSubmitOrder(order)
  }
  return submitOrder(order)
}

export { USE_MOCK, USE_SHEET }
