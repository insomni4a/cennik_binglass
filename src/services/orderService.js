import { placeOrder } from './dataService'
import { sendOrderEmailFallback } from './orderEmailService'

function buildOrderSuccessMessage(apiResult) {
  if (apiResult?.message) return apiResult.message
  if (apiResult?.emailSent) return 'Zamówienie złożone i wysłane e-mailem.'
  if (apiResult?.customerEmailSent) {
    return 'Zamówienie zapisane — wysłano potwierdzenie do klienta.'
  }
  return 'Zamówienie zapisane.'
}

export async function submitOrderWithEmail(order) {
  let apiResult = null
  let apiError = null

  try {
    apiResult = await placeOrder(order)
  } catch (err) {
    apiError = err
  }

  if (apiResult?.success) {
    return {
      saved: true,
      emailSent: Boolean(apiResult.emailSent),
      customerEmailSent: Boolean(apiResult.customerEmailSent),
      customerEmailError: apiResult.customerEmailError || null,
      customerEmailWarning: apiResult.customerEmailWarning || null,
      clientAdded: Boolean(apiResult.clientAdded),
      clientRegisterError: apiResult.clientRegisterError || null,
      emailError: apiResult.emailError || null,
      message: buildOrderSuccessMessage(apiResult),
      via: 'api',
    }
  }

  try {
    await sendOrderEmailFallback(order)
    return {
      saved: Boolean(apiResult?.success),
      emailSent: true,
      customerEmailSent: false,
      message: apiResult?.success
        ? 'Zamówienie zapisane i wysłane e-mailem do Binglass (bez potwierdzenia dla klienta).'
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
