const API_URL = import.meta.env.VITE_API_URL
export const API_URL_DISPLAY = API_URL
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true' || !API_URL
export const EXPECTED_API_VERSION = 3

function apiUrl(params) {
  const query = new URLSearchParams({ ...params, _: String(Date.now()) })
  return `${API_URL}?${query}`
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 20000) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Przekroczono czas oczekiwania na odpowiedź serwera. Spróbuj ponownie.')
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}

async function handleResponse(response) {
  const data = await response.json()
  if (data.error) {
    throw new Error(data.error)
  }
  return data
}

export function isStaleApiResponse(data) {
  if (!data || USE_MOCK) return false
  return Number(data.version) !== EXPECTED_API_VERSION || data.clientRegisterOnOrder !== true
}

export async function fetchClient(nip, { includeHistory = true, timeoutMs = 45000 } = {}) {
  const params = { action: 'client', nip }
  if (!includeHistory) params.history = '0'
  const response = await fetchWithTimeout(apiUrl(params), {}, timeoutMs)
  if (!response.ok) {
    throw new Error('Błąd połączenia z serwerem (GET client)')
  }
  return handleResponse(response)
}

export async function fetchCatalog() {
  const response = await fetch(`${API_URL}?${new URLSearchParams({ action: 'cenniki' })}`)
  if (!response.ok) {
    throw new Error('Błąd połączenia z serwerem (GET cenniki)')
  }
  const data = await handleResponse(response)
  return {
    version: data.version,
    orderEmail: data.orderEmail,
    clientRegisterOnOrder: data.clientRegisterOnOrder,
    cenniki: data.cenniki ?? [],
    dodatki: data.dodatki ?? [{ dodatek: 'Brak', cena: 0 }],
    tryby: data.tryby ?? [{ tryb: 'Standard', procent: 0 }],
    klienci: data.klienci ?? [],
  }
}

export async function fetchApiRaw() {
  const cennikiUrl = apiUrl({ action: 'cenniki' })
  const cennikiRes = await fetch(cennikiUrl)
  const cenniki = await cennikiRes.json()
  return {
    cenniki,
    cennikiUrl,
    apiOk: Number(cenniki.version) === EXPECTED_API_VERSION && cenniki.clientRegisterOnOrder === true,
  }
}

export async function submitOrder(order) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(order),
  })

  const text = await response.text()
  let data
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    throw new Error(
      'Serwer zwrócił niepoprawną odpowiedź przy składaniu zamówienia. Sprawdź wdrożenie Apps Script (POST).'
    )
  }

  if (data.error) {
    throw new Error(data.error)
  }
  return data
}
