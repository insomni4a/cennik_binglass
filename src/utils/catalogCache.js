const CACHE_KEY = 'binglass_catalog_v1'
const TTL_MS = 15 * 60 * 1000

export function readCatalogCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { data, at } = JSON.parse(raw)
    if (!data || Date.now() - at > TTL_MS) return null
    return data
  } catch {
    return null
  }
}

export function writeCatalogCache(catalog) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data: catalog }))
  } catch {
    // localStorage niedostępny — ignoruj
  }
}
