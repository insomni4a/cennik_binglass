const NIP_WEIGHTS = [6, 5, 7, 2, 3, 4, 5, 6, 7]

/**
 * Normalizuje NIP – usuwa wszystko poza cyframi.
 */
export function normalizeNip(nip) {
  return String(nip).replace(/\D/g, '')
}

/**
 * Formatuje NIP do postaci XXX-XXX-XX-XX (opcjonalnie, do wyświetlania).
 */
export function formatNip(nip) {
  const digits = normalizeNip(nip)
  if (digits.length !== 10) return digits
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 8)}-${digits.slice(8, 10)}`
}

/**
 * Waliduje polski NIP (10 cyfr + suma kontrolna).
 * Zwraca { valid: boolean, message?: string, normalized?: string }
 */
export function validateNip(nip) {
  const normalized = normalizeNip(nip)

  if (!normalized) {
    return { valid: false, message: 'Podaj NIP firmy.' }
  }

  if (normalized.length !== 10) {
    return { valid: false, message: 'NIP musi składać się z 10 cyfr.' }
  }

  if (!/^\d{10}$/.test(normalized)) {
    return { valid: false, message: 'NIP może zawierać tylko cyfry.' }
  }

  const digits = normalized.split('').map(Number)
  const checksum =
    NIP_WEIGHTS.reduce((sum, weight, i) => sum + weight * digits[i], 0) % 11

  if (checksum === 10 || checksum !== digits[9]) {
    return { valid: false, message: 'Nieprawidłowy NIP (błędna suma kontrolna).' }
  }

  return { valid: true, normalized }
}
