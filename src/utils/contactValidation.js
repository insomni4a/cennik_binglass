export function validateEmail(email) {
  const trimmed = String(email || '').trim()
  if (!trimmed) {
    return { valid: false, message: 'Podaj adres e-mail.' }
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { valid: false, message: 'Podaj prawidłowy adres e-mail.' }
  }
  return { valid: true, normalized: trimmed }
}

export function validatePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  if (!digits) {
    return { valid: false, message: 'Podaj numer telefonu.' }
  }
  if (digits.length < 9) {
    return { valid: false, message: 'Numer telefonu musi mieć co najmniej 9 cyfr.' }
  }
  return { valid: true, normalized: digits }
}

export function formatPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
  }
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`
}
