function normalizeRodzajKey(rodzaj) {
  return String(rodzaj ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
}

/** Komunikat ostrzegawczy pod polem Rodzaj (null = brak banera). */
export function getRodzajBannerMessage(rodzaj) {
  const key = normalizeRodzajKey(rodzaj)

  if (key === 'VSG JUMBO') {
    return 'VSG JUMBO OD ROZMIARU 3210mm do 4500mm'
  }

  if (key === 'VSG' || key === 'VSG STANDAR' || key === 'VSG STANDARD') {
    return 'VSG STANDAR DO ROZMIARU 3210mm'
  }

  return null
}
