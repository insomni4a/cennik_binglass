import {
  ORDER_NOTIFY_EMAIL,
  buildOrderEmailBody,
  buildOrderEmailSubject,
} from '../utils/buildOrderEmailBody'

const ORDER_EMAIL_TO = import.meta.env.VITE_ORDER_EMAIL_TO || ORDER_NOTIFY_EMAIL

/** Zapasowa wysyłka e-maila z przeglądarki (FormSubmit, bez załącznika). */
export async function sendOrderEmailFallback(order) {
  const formData = new FormData()
  formData.append('_subject', buildOrderEmailSubject(order))
  formData.append('message', buildOrderEmailBody(order))
  formData.append('_replyto', order.email)
  formData.append('_captcha', 'false')
  formData.append('_template', 'table')

  const response = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(ORDER_EMAIL_TO)}`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: formData,
  })

  const text = await response.text()
  let data = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    throw new Error('Usługa e-mail zwróciła niepoprawną odpowiedź.')
  }

  if (!response.ok || data.success === false) {
    throw new Error(data.message || 'Nie udało się wysłać e-maila z zamówieniem.')
  }
}

export { ORDER_EMAIL_TO }
