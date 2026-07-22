import { placeOrder } from './dataService'
import { sendOrderEmailFallback } from './orderEmailService'

export async function submitOrderWithEmail(order) {
  let apiResult = null
  let apiError = null

  try {
    apiResult = await placeOrder(order)
  } catch (err) {
    apiError = err
  }

  if (apiResult?.emailSent) {
    return {
      saved: true,
      emailSent: true,
      customerEmailSent: Boolean(apiResult.customerEmailSent),
      message: apiResult.message || 'Zamówienie złożone i wysłane e-mailem.',
      via: 'api',
    }
  }

  try {
    await sendOrderEmailFallback(order)
    return {
      saved: Boolean(apiResult?.success),
      emailSent: true,
      message: apiResult?.success
        ? 'Zamówienie zapisane i wysłane e-mailem.'
        : 'Zamówienie zostało wysłane e-mailem do Binglass.',
      via: 'fallback',
      apiError: apiError?.message || apiResult?.emailError || null,
    }
  } catch (fallbackError) {
    if (apiResult?.success) {
      throw new Error(
        `Zamówienie zapisane w arkuszu, ale e-mail nie został wysłany: ${fallbackError.message}`
      )
    }

    throw new Error(
      apiError?.message ||
        fallbackError.message ||
        'Nie udało się złożyć zamówienia ani wysłać e-maila.'
    )
  }
}
