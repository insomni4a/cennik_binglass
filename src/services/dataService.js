import { USE_MOCK, fetchClient, fetchCatalog, submitOrder, isStaleApiResponse } from './api'
import { normalizeCatalog } from './pricingService'
import { enrichClientProfile } from '../utils/clientLookup'

export const USE_SHEET = Boolean(import.meta.env.VITE_SHEET_ID)

export async function loadCatalog() {
  if (USE_MOCK) {
    const { mockGetCatalog } = await import('./mockService')
    return { ...mockGetCatalog(), apiStale: false, source: 'mock' }
  }

  if (import.meta.env.VITE_API_URL) {
    try {
      const raw = await fetchCatalog()
      return {
        ...normalizeCatalog(raw),
        apiStale: isStaleApiResponse(raw),
        source: 'api',
      }
    } catch (err) {
      if (USE_SHEET) {
        const { loadCatalogFromSheet } = await import('./sheetService')
        const raw = await loadCatalogFromSheet()
        return {
          ...normalizeCatalog(raw),
          apiStale: false,
          source: 'sheet',
        }
      }
      throw err
    }
  }

  if (USE_SHEET) {
    const { loadCatalogFromSheet } = await import('./sheetService')
    const raw = await loadCatalogFromSheet()
    return {
      ...normalizeCatalog(raw),
      apiStale: false,
      source: 'sheet',
    }
  }

  throw new Error('Brak źródła cennika (ustaw VITE_API_URL lub VITE_SHEET_ID).')
}

export async function lookupClient(nip) {
  if (USE_MOCK) {
    const { mockFetchClient } = await import('./mockService')
    return enrichClientProfile(await mockFetchClient(nip))
  }

  if (import.meta.env.VITE_API_URL) {
    try {
      return enrichClientProfile(await fetchClient(nip))
    } catch (err) {
      if (USE_SHEET) {
        const { lookupClientFromSheet } = await import('./sheetService')
        return lookupClientFromSheet(nip)
      }
      throw err
    }
  }

  if (USE_SHEET) {
    const { lookupClientFromSheet } = await import('./sheetService')
    return lookupClientFromSheet(nip)
  }

  throw new Error('Brak źródła danych klienta (API lub arkusz).')
}

export async function placeOrder(order) {
  if (USE_MOCK) {
    const { mockSubmitOrder } = await import('./mockService')
    return mockSubmitOrder(order)
  }
  return submitOrder(order)
}

export { USE_MOCK }
