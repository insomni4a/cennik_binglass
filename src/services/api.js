const API_URL = import.meta.env.VITE_API_URL
export const API_URL_DISPLAY = API_URL
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true' || !API_URL
export const EXPECTED_API_VERSION = 2

function apiUrl(params) {
  const query = new URLSearchParams({ ...params, _: String(Date.now()) })
  return `${API_URL}?${query}`
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
  return Number(data.version) !== EXPECTED_API_VERSION
}

export async function fetchClient(nip) {
  const response = await fetch(apiUrl({ action: 'client', nip }))
  if (!response.ok) {
    throw new Error('Błąd połączenia z serwerem (GET client)')
  }
  return handleResponse(response)
}

export async function fetchCatalog() {
  const response = await fetch(apiUrl({ action: 'cenniki' }))
  if (!response.ok) {
    throw new Error('Błąd połączenia z serwerem (GET cenniki)')
  }
  const data = await handleResponse(response)
  return {
    version: data.version,
    cenniki: data.cenniki ?? [],
    dodatki: data.dodatki ?? [{ dodatek: 'Brak', cena: 0 }],
    tryby: data.tryby ?? [{ tryb: 'Standard', procent: 0 }],
  }
}

export async function fetchApiRaw() {
  const cennikiUrl = apiUrl({ action: 'cenniki' })
  const cennikiRes = await fetch(cennikiUrl)
  const cenniki = await cennikiRes.json()
  return {
    cenniki,
    cennikiUrl,
    apiOk: Number(cenniki.version) === EXPECTED_API_VERSION,
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

export function supportsOrderEmailApi(data) {
  return Number(data?.version) >= 3 && data?.orderEmail === true
}
