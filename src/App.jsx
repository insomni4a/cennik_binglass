import { useState, useEffect, lazy, Suspense } from 'react'
import {
  getRodzaje,
  getProduktyForRodzaj,
  getDodatkiList,
  getDefaultLineValues,
  calculateLinePrice,
  getTrybProcent,
  DEFAULT_CENNIK,
} from './services/pricingService'
import { loadCatalog, lookupClient, USE_MOCK, USE_SHEET } from './services/dataService'
import { submitOrderWithEmail } from './services/orderService'
import { fetchApiRaw } from './services/api'
import { validateNip, formatNip } from './utils/nipValidation'
import { validateEmail, validatePhone, formatPhone } from './utils/contactValidation'
import { buildOrderPayload } from './utils/buildOrderPayload'
import { calcLineAreaM2, formatAreaM2, formatDimensions, normalizeIlosc, needsShortSide, calcAreaPerPieceM2 } from './utils/dimensions'
import { readCatalogCache, writeCatalogCache } from './utils/catalogCache'
import { applyRabatToTotal, enrichItemsWithRabat, enrichClientProfile } from './utils/clientLookup'
import { getRodzajBannerMessage } from './utils/rodzajBanner'
import { BINGLASS_LOGO_URL } from './constants'
import './App.css'

const ApiStaleWarning = lazy(() => import('./components/ApiStaleWarning.jsx'))

const COLUMNS = [
  { key: 'rodzaj', label: 'Rodzaj' },
  { key: 'produkt', label: 'Produkt' },
  { key: 'dodatek', label: 'Dodatek' },
  { key: 'width', label: 'Szer. (mm)' },
  { key: 'height', label: 'Wys. (mm)' },
  { key: 'shortSide', label: 'Krótk. bok' },
  { key: 'ilosc', label: 'Ilość' },
  { key: 'area', label: 'm²' },
  { key: 'cena', label: 'Cena' },
  { key: 'tryb', label: 'Tryb' },
]

function createLine(cenniki, dodatki, defaults, defaultTryb = '') {
  const base = defaults ?? getDefaultLineValues(cenniki, dodatki)
  return {
    id: crypto.randomUUID(),
    rodzaj: base.rodzaj,
    produkt: base.produkt,
    dodatek: base.dodatek,
    width: '',
    height: '',
    shortSide: '',
    ilosc: 1,
    tryb: defaultTryb,
    cena: null,
  }
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function MinusIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function App() {
  const [cenniki, setCenniki] = useState([])
  const [dodatki, setDodatki] = useState([])
  const [tryby, setTryby] = useState([])
  const [loadingData, setLoadingData] = useState(true)
  const [dataError, setDataError] = useState('')
  const [apiStale, setApiStale] = useState(false)
  const [apiDiag, setApiDiag] = useState(null)
  const [apiDiagLoading, setApiDiagLoading] = useState(false)

  const [nip, setNip] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [nipTouched, setNipTouched] = useState(false)
  const [companyNameTouched, setCompanyNameTouched] = useState(false)
  const [lines, setLines] = useState([])
  const [quote, setQuote] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [offerSuccess, setOfferSuccess] = useState('')
  const [showOrderForm, setShowOrderForm] = useState(false)
  const [orderPhone, setOrderPhone] = useState('')
  const [orderEmail, setOrderEmail] = useState('')
  const [orderTouched, setOrderTouched] = useState(false)
  const [orderSuccess, setOrderSuccess] = useState('')
  const [clientProfile, setClientProfile] = useState(null)
  const [orderThankYou, setOrderThankYou] = useState(false)
  const [lookingUpClient, setLookingUpClient] = useState(false)

  const nipValidation = nipTouched || nip.length > 0 ? validateNip(nip) : { valid: true }
  const companyNameValid = companyName.trim().length > 0
  const emailValidation = orderTouched || orderEmail.length > 0 ? validateEmail(orderEmail) : { valid: true }
  const phoneValidation = orderTouched || orderPhone.length > 0 ? validatePhone(orderPhone) : { valid: true }

  const applyCatalog = (catalog) => {
    const { cenniki: data, dodatki: dodatkiData, tryby: trybData, apiStale: stale } = catalog
    if (data.length === 0) {
      setDataError(
        'Arkusz Cenniki jest pusty lub nie zawiera danych. Sprawdź nagłówki i wiersze w arkuszu Google.'
      )
      return
    }
    setDataError('')
    setCenniki(data)
    setDodatki(dodatkiData)
    setTryby(trybData)
    setApiStale(stale)
    const defaultTryb = trybData[0]?.tryb ?? ''
    setLines([createLine(data, dodatkiData, null, defaultTryb)])
  }

  const fetchCatalogData = () => {
    const cached = readCatalogCache()
    if (cached) {
      applyCatalog(cached)
      setLoadingData(false)
    } else {
      setLoadingData(true)
    }
    setDataError('')

    try {
      return loadCatalog()
        .then((catalog) => {
          writeCatalogCache(catalog)
          applyCatalog(catalog)
        })
        .catch((err) => {
          if (!cached) {
            setDataError(
              err.message || 'Nie udało się pobrać cenników. Sprawdź połączenie z API.'
            )
          }
        })
        .finally(() => setLoadingData(false))
    } catch (err) {
      setDataError(err.message || 'Nie udało się uruchomić ładowania cenników.')
      setLoadingData(false)
      return Promise.resolve()
    }
  }

  useEffect(() => {
    fetchCatalogData()
  }, [])

  const runApiDiagnostic = async () => {
    if (USE_MOCK) return
    setApiDiagLoading(true)
    try {
      const result = await fetchApiRaw()
      setApiDiag(result)
    } catch (err) {
      setApiDiag({ error: err.message })
    } finally {
      setApiDiagLoading(false)
    }
  }

  const clearQuote = () => {
    setQuote(null)
    setOfferSuccess('')
    setOrderSuccess('')
    setShowOrderForm(false)
    setOrderPhone('')
    setOrderEmail('')
    setOrderTouched(false)
    setError('')
    setLines((prev) => prev.map((line) => ({ ...line, cena: null, cenaPoRabacie: null })))
  }

  const refreshClientProfile = async (normalizedNip) => {
    const client = await lookupClient(normalizedNip)
    return enrichClientProfile(client)
  }

  const handleReturningClientLookup = async () => {
    setNipTouched(true)
    setError('')
    setOfferSuccess('')

    const nipResult = validateNip(nip)
    if (!nipResult.valid) {
      setError(nipResult.message)
      setClientProfile(null)
      return
    }

    setLookingUpClient(true)
    try {
      const profile = await refreshClientProfile(nipResult.normalized)
      setClientProfile(profile)

      if (profile.found && profile.nazwa && profile.nazwa !== 'Nieznany klient') {
        setCompanyName(profile.nazwa)
        setCompanyNameTouched(false)
      } else {
        setCompanyName('')
        setClientProfile({ ...profile, found: false })
        setError('Nie znaleziono tego NIP w bazie stałych klientów. Wpisz nazwę firmy ręcznie.')
      }
    } catch (err) {
      setClientProfile(null)
      setError(err.message || 'Nie udało się sprawdzić NIP w bazie klientów.')
    } finally {
      setLookingUpClient(false)
    }
  }

  const withCurrentCompanyName = (currentQuote) => {
    if (!currentQuote) return null
    const name = companyName.trim()
    return name ? { ...currentQuote, companyName: name } : currentQuote
  }

  const resetCennikAfterOrder = () => {
    const defaultTryb = tryby[0]?.tryb ?? ''
    setLines([createLine(cenniki, dodatki, null, defaultTryb)])
    setQuote(null)
    setOfferSuccess('')
    setOrderSuccess('')
    setShowOrderForm(false)
    setOrderPhone('')
    setOrderEmail('')
    setOrderTouched(false)
    setError('')
  }

  const handleResetCennik = () => {
    const defaultTryb = tryby[0]?.tryb ?? ''
    setLines([createLine(cenniki, dodatki, null, defaultTryb)])
    setQuote(null)
    setOfferSuccess('')
    setOrderSuccess('')
    setShowOrderForm(false)
    setOrderPhone('')
    setOrderEmail('')
    setOrderTouched(false)
    setCompanyName('')
    setCompanyNameTouched(false)
    setError('')
  }

  const handleNipChange = (value) => {
    setNip(value.replace(/\D/g, '').slice(0, 10))
    setCompanyName('')
    setCompanyNameTouched(false)
    setClientProfile(null)
    setOrderThankYou(false)
    clearQuote()
  }

  const handleCompanyNameChange = (value) => {
    setCompanyName(value)
    setQuote(null)
    setOfferSuccess('')
    setError('')
  }

  const handleNipBlur = () => setNipTouched(true)

  const updateLine = (id, updates) => {
    setLines((prev) =>
      prev.map((line) =>
        line.id === id ? { ...line, ...updates, cena: null } : line
      )
    )
    setQuote(null)
    setOfferSuccess('')
    setError('')
  }

  const handleRodzajChange = (id, rodzaj) => {
    const produkty = getProduktyForRodzaj(cenniki, rodzaj)
    updateLine(id, {
      rodzaj,
      produkt: produkty[0] ?? '',
    })
  }

  const addLineAfter = (afterId) => {
    setLines((prev) => {
      const index = prev.findIndex((line) => line.id === afterId)
      const sourceLine = prev[index]
      const next = [...prev]
      next.splice(index + 1, 0, createLine(cenniki, dodatki, null, sourceLine?.tryb ?? tryby[0]?.tryb ?? ''))
      return next
    })
    setQuote(null)
  }

  const removeLine = (id) => {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((line) => line.id !== id)))
    setQuote(null)
  }

  const handleCalculate = async () => {
    setError('')
    setQuote(null)
    setOfferSuccess('')
    setNipTouched(true)
    setCompanyNameTouched(true)

    const nipResult = validateNip(nip)
    if (!nipResult.valid) {
      setError(nipResult.message)
      return
    }

    const trimmedCompanyName = companyName.trim()
    if (!trimmedCompanyName) {
      setError('Podaj nazwę firmy.')
      return
    }

    const parsedLines = []
    for (const line of lines) {
      if (!line.tryb) {
        setError('Wybierz tryb realizacji dla każdej pozycji.')
        return
      }
      const ilosc = normalizeIlosc(line.ilosc)
      const useTrapezoid = needsShortSide(line.dodatek)
      if (useTrapezoid && (!line.shortSide || Number(line.shortSide) <= 0)) {
        setError('Podaj krótki bok (mm) dla pozycji z FIX + zatępienie lub FIX + szlif.')
        return
      }
      const areaPerPiece = calcAreaPerPieceM2(
        line.width,
        line.height,
        useTrapezoid ? line.shortSide : null
      )
      const areaNum = calcLineAreaM2(
        line.width,
        line.height,
        line.ilosc,
        useTrapezoid ? line.shortSide : null
      )
      if (areaPerPiece === null) {
        setError(
          useTrapezoid
            ? 'Podaj prawidłową szerokość, wysokość i krótki bok (mm) większe od zera dla każdej pozycji.'
            : 'Podaj prawidłową szerokość i wysokość (mm) większe od zera dla każdej pozycji.'
        )
        return
      }
      if (ilosc === null) {
        setError('Ilość formatek musi być liczbą całkowitą większą od zera.')
        return
      }
      parsedLines.push({ ...line, ilosc, areaPerPiece, areaNum })
    }

    setLoading(true)
    try {
      const client = enrichClientProfile(await lookupClient(nipResult.normalized))
      const updatedLines = [...lines]
      const items = []
      let subtotal = 0
      let surcharge = 0

      for (let i = 0; i < parsedLines.length; i++) {
        const line = parsedLines[i]
        const unitPrice = calculateLinePrice(
          cenniki,
          dodatki,
          DEFAULT_CENNIK,
          line.rodzaj,
          line.produkt,
          line.dodatek,
          line.areaPerPiece,
          line.areaNum
        )

        if (unitPrice === null) {
          setError(
            `Brak cennika dla: ${DEFAULT_CENNIK} / ${line.rodzaj} / ${line.produkt} / ${formatAreaM2(line.areaNum)} m² łącznie (lub nieznany dodatek).`
          )
          return
        }

        const lineSubtotal = unitPrice * line.ilosc
        const procent = getTrybProcent(tryby, line.tryb)
        const lineSurcharge = lineSubtotal * (procent / 100)
        const lineTotal = lineSubtotal + lineSurcharge

        subtotal += lineSubtotal
        surcharge += lineSurcharge
        updatedLines[i] = { ...updatedLines[i], cena: lineTotal }

        items.push({
          rodzaj: line.rodzaj,
          produkt: line.produkt,
          dodatek: line.dodatek,
          width: line.width,
          height: line.height,
          shortSide: needsShortSide(line.dodatek) ? line.shortSide : null,
          ilosc: line.ilosc,
          tryb: line.tryb,
          procent,
          area: line.areaNum,
          areaPerPiece: line.areaPerPiece,
          lineSubtotal,
          lineSurcharge,
          lineTotal,
        })
      }

      const uniqueTrybs = [...new Set(items.map((item) => item.tryb))]
      const trybLabel = uniqueTrybs.length === 1 ? uniqueTrybs[0] : 'Różne'
      const itemsWithRabat = enrichItemsWithRabat(items, client.procentRabatu)
      const { grossTotal, discountAmount, totalPrice } = applyRabatToTotal(
        subtotal,
        surcharge,
        client.procentRabatu
      )

      setLines(
        updatedLines.map((line, i) => ({
          ...line,
          cenaPoRabacie: itemsWithRabat[i]?.lineTotalAfterRabat ?? line.cena,
        }))
      )
      setQuote({
        nip: client.nip,
        companyName: trimmedCompanyName,
        cennik: DEFAULT_CENNIK,
        procentRabatu: client.procentRabatu,
        found: client.found,
        tryb: trybLabel,
        procent: uniqueTrybs.length === 1 ? items[0].procent : null,
        subtotal,
        surcharge,
        grossTotal,
        discountAmount,
        totalPrice,
        items: itemsWithRabat,
      })
    } catch (err) {
      setError(err.message || 'Błąd połączenia z serwerem. Spróbuj ponownie.')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateOffer = async () => {
    const exportQuote = withCurrentCompanyName(quote)
    if (!exportQuote) {
      setError('Najpierw oblicz cenę.')
      return
    }

    if (!exportQuote.companyName?.trim()) {
      setCompanyNameTouched(true)
      setError('Podaj nazwę firmy.')
      return
    }

    setError('')
    setOfferSuccess('')
    setLoading(true)

    const pdfWindow = window.open('', '_blank')
    if (!pdfWindow) {
      setLoading(false)
      setError('Przeglądarka zablokowała nową kartę. Zezwól na wyskakujące okna dla tej strony i spróbuj ponownie.')
      return
    }

    try {
      const { generateOfferPdf: generatePdf } = await import('./utils/generateOfferPdf')
      await generatePdf(exportQuote, pdfWindow)
      setOfferSuccess(`Oferta PDF dla ${exportQuote.companyName} otwarta w nowej karcie.`)
    } catch (err) {
      pdfWindow.close()
      setError(err.message || 'Nie udało się wygenerować oferty PDF.')
    } finally {
      setLoading(false)
    }
  }

  const handleShowOrderForm = () => {
    if (!quote) {
      setError('Najpierw oblicz cenę.')
      return
    }
    setError('')
    setOrderSuccess('')
    setOrderThankYou(false)

    if (clientProfile?.lastTelefon) {
      setOrderPhone(clientProfile.lastTelefon)
    }
    if (clientProfile?.lastEmail) {
      setOrderEmail(clientProfile.lastEmail)
    }

    setShowOrderForm(true)
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    })
  }

  const handleSubmitOrder = async () => {
    const exportQuote = withCurrentCompanyName(quote)
    if (!exportQuote) {
      setError('Najpierw oblicz cenę.')
      return
    }

    if (!exportQuote.companyName?.trim()) {
      setCompanyNameTouched(true)
      setError('Podaj nazwę firmy.')
      return
    }

    setOrderTouched(true)
    setError('')
    setOrderSuccess('')

    const emailResult = validateEmail(orderEmail)
    const phoneResult = validatePhone(orderPhone)
    if (!emailResult.valid) {
      setError(emailResult.message)
      return
    }
    if (!phoneResult.valid) {
      setError(phoneResult.message)
      return
    }

    setLoading(true)
    try {
      const result = await submitOrderWithEmail(
        buildOrderPayload(exportQuote, {
          email: emailResult.normalized,
          telefon: phoneResult.normalized,
        })
      )

      resetCennikAfterOrder()
      setOrderThankYou(true)

      const clientNote = result.clientAdded
        ? ` Klient dopisany do zakładki Klienci (wiersz ${result.clientRegisterRow || '?'}).`
        : result.clientRegisterReason === 'exists'
          ? ' Klient z tym NIP jest już w zakładce Klienci.'
          : ''
      const customerNote = result.customerEmailSent
        ? ' Na Twój adres e-mail wysłaliśmy potwierdzenie zamówienia.'
        : ''
      setOrderSuccess(`${result.message}${clientNote}${customerNote}`)

      const postOrderIssues = []
      if (result.customerEmailWarning) postOrderIssues.push(result.customerEmailWarning)
      if (result.customerEmailError) {
        postOrderIssues.push(
          `Potwierdzenie e-mail do klienta nie zostało wysłane: ${result.customerEmailError}`
        )
      }
      if (result.clientRegisterError) {
        postOrderIssues.push(
          `Wpis do zakładki Klienci nie powiódł się: ${result.clientRegisterError}`
        )
      } else if (
        result.saved &&
        !result.clientAdded &&
        result.clientRegisterReason &&
        result.clientRegisterReason !== 'exists'
      ) {
        postOrderIssues.push(
          `Klient nie został dopisany do zakładki Klienci (powód: ${result.clientRegisterReason}).`
        )
      }
      if (result.emailError && !result.emailSent) {
        postOrderIssues.push(`Powiadomienie do Binglass nie zostało wysłane: ${result.emailError}`)
      }
      if (postOrderIssues.length > 0) {
        setError(postOrderIssues.join(' '))
      }
    } catch (err) {
      setError(err.message || 'Nie udało się złożyć zamówienia. Spróbuj ponownie.')
    } finally {
      setLoading(false)
    }
  }

  if (loadingData) {
    return (
      <div className="app-shell">
        <div className="app">
          <div className="card loading-card">
            <div className="spinner" aria-hidden="true" />
            <p className="loading-text">Ładowanie cenników...</p>
          </div>
        </div>
      </div>
    )
  }

  if (dataError) {
    return (
      <div className="app-shell">
        <div className="app">
          <div className="card">
            <div className="error">{dataError}</div>
            <p className="hint">
              Upewnij się, że zmienna <code>VITE_API_URL</code> w pliku <code>.env</code> wskazuje
              na wdrożony Google Apps Script, lub ustaw <code>VITE_USE_MOCK=true</code> do testów
              offline.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const rodzaje = getRodzaje(cenniki)
  const dodatkiList = getDodatkiList(dodatki)
  const showShortSideColumn = lines.some((line) => needsShortSide(line.dodatek))
  const welcomeCompanyName =
    companyName.trim() ||
    (clientProfile?.nazwa && clientProfile.nazwa !== 'Nieznany klient'
      ? clientProfile.nazwa
      : quote?.companyName)
  const showWelcomeBanner = Boolean(
    clientProfile?.found &&
      welcomeCompanyName &&
      welcomeCompanyName !== 'Nieznany klient'
  )

  return (
    <div className="app-shell">
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img
            src={BINGLASS_LOGO_URL}
            alt="Binglass"
            className="brand-logo"
          />
          <div className="brand-text">
            <h1>Cennik Binglass</h1>
            <p className="subtitle">Kalkulator cen na podstawie NIP i powierzchni</p>
          </div>
        </div>
        <div className="topbar-badges">
          {USE_MOCK && <span className="badge">Tryb testowy (mock)</span>}
          {USE_SHEET && !USE_MOCK && (
            <span className="badge badge-sheet">Dane z arkusza Google</span>
          )}
        </div>
      </header>

      <main className="main-content">
      {showWelcomeBanner && (
        <div className="client-banner client-banner--welcome" role="status">
          Witaj ponownie {welcomeCompanyName} — przyznany rabat &quot;
          {Number(clientProfile.procentRabatu ?? 0)}%&quot;
        </div>
      )}
      {apiStale && !USE_SHEET && (
        <Suspense fallback={null}>
          <ApiStaleWarning
            apiDiag={apiDiag}
            apiDiagLoading={apiDiagLoading}
            onRefresh={fetchCatalogData}
            onRunDiagnostic={runApiDiagnostic}
          />
        </Suspense>
      )}

      <section className="card">
        <h2 className="card-title">Klient</h2>
        <div className="client-section">
          <div className="client-field-stack client-field">
            <div className="nip-group">
              <label htmlFor="nip">NIP firmy</label>
              <div className="nip-row">
                <input
                  id="nip"
                  type="text"
                  inputMode="numeric"
                  value={formatNip(nip)}
                  onChange={(e) => handleNipChange(e.target.value)}
                  onBlur={handleNipBlur}
                  placeholder="np. 123-456-78-90"
                  disabled={loading || lookingUpClient}
                  className={nipTouched && !nipValidation.valid ? 'input-error' : ''}
                  aria-invalid={nipTouched && !nipValidation.valid}
                />
                <button
                  type="button"
                  className="btn-returning-client"
                  onClick={handleReturningClientLookup}
                  disabled={loading || lookingUpClient}
                >
                  {lookingUpClient ? 'Sprawdzam…' : 'STAŁY KLIENT - WPISZ NIP I KLIKNIJ'}
                </button>
              </div>
              {nipTouched && !nipValidation.valid && (
                <span className="field-error">{nipValidation.message}</span>
              )}
            </div>
            <div className="company-group">
              <label htmlFor="company-name">Nazwa firmy</label>
              <input
                id="company-name"
                type="text"
                value={companyName}
                onChange={(e) => handleCompanyNameChange(e.target.value)}
                onBlur={() => setCompanyNameTouched(true)}
                placeholder="np. Binglass Sp. z o.o."
                disabled={loading}
                className={companyNameTouched && !companyNameValid ? 'input-error' : ''}
                aria-invalid={companyNameTouched && !companyNameValid}
              />
              {companyNameTouched && !companyNameValid && (
                <span className="field-error">Podaj nazwę firmy.</span>
              )}
            </div>
          </div>

          {showOrderForm && quote && (
            <>
              <div className="order-field client-field">
                <label htmlFor="order-phone">Numer telefonu</label>
                <input
                  id="order-phone"
                  type="tel"
                  inputMode="tel"
                  value={formatPhone(orderPhone)}
                  onChange={(e) => setOrderPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  onBlur={() => setOrderTouched(true)}
                  placeholder="np. 123 456 789"
                  disabled={loading}
                  className={orderTouched && !phoneValidation.valid ? 'input-error' : ''}
                  aria-invalid={orderTouched && !phoneValidation.valid}
                />
                {orderTouched && !phoneValidation.valid && (
                  <span className="field-error">{phoneValidation.message}</span>
                )}
              </div>
              <div className="order-field client-field">
                <label htmlFor="order-email">Adres e-mail</label>
                <input
                  id="order-email"
                  type="email"
                  inputMode="email"
                  value={orderEmail}
                  onChange={(e) => setOrderEmail(e.target.value)}
                  onBlur={() => setOrderTouched(true)}
                  placeholder="np. kontakt@firma.pl"
                  disabled={loading}
                  className={orderTouched && !emailValidation.valid ? 'input-error' : ''}
                  aria-invalid={orderTouched && !emailValidation.valid}
                />
                {orderTouched && !emailValidation.valid && (
                  <span className="field-error">{emailValidation.message}</span>
                )}
              </div>
              <div className="order-form-actions order-form-actions--inline">
                <button
                  type="button"
                  className="btn btn-primary btn-compact"
                  onClick={handleSubmitOrder}
                  disabled={loading}
                >
                  {loading ? 'Wysyłanie...' : 'Złóż zamówienie'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-compact"
                  onClick={() => {
                    setShowOrderForm(false)
                    setOrderTouched(false)
                    setError('')
                  }}
                  disabled={loading}
                >
                  Anuluj
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      {orderThankYou && (
        <div className="client-banner client-banner--thanks" role="status">
          Dziękujemy za złożenie zamówienia, czy chcesz coś jeszcze wycenić?
        </div>
      )}

      <section className="card">
        <h2 className="card-title">
          Pozycje
          <span className="card-title-required">(WSZYSTKIE POLA WYMAGANE)</span>
        </h2>
        <div className="table-scroll">
          <div className={`product-table${showShortSideColumn ? ' product-table--has-short-side' : ''}`}>
            <div className="product-row product-row--header">
              {COLUMNS.filter((col) => col.key !== 'shortSide' || showShortSideColumn).map((col) => (
                <div key={col.key} className="cell cell--label">
                  {col.label}
                </div>
              ))}
              <div className="cell cell--label cell--actions" aria-hidden="true" />
            </div>

            {lines.map((line, lineIndex) => {
              const produkty = getProduktyForRodzaj(cenniki, line.rodzaj)
              const lineNeedsShortSide = needsShortSide(line.dodatek)
              const areaPreview = calcLineAreaM2(
                line.width,
                line.height,
                line.ilosc,
                lineNeedsShortSide ? line.shortSide : null
              )
              const rodzajBanner = getRodzajBannerMessage(line.rodzaj)

              return (
                <div key={line.id} className="product-line">
                  {rodzajBanner && (
                    <div className="product-row product-row--banner">
                      <div className="product-rodzaj-banner" role="status">
                        {rodzajBanner}
                      </div>
                    </div>
                  )}

                  <div className="product-row">
                  <div className="cell" data-label="Rodzaj">
                    <select
                      value={line.rodzaj}
                      onChange={(e) => handleRodzajChange(line.id, e.target.value)}
                      disabled={loading}
                      aria-label="Rodzaj"
                    >
                      {rodzaje.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>

                  <div className="cell" data-label="Produkt">
                    <select
                      value={line.produkt}
                      onChange={(e) => updateLine(line.id, { produkt: e.target.value })}
                      disabled={loading}
                      aria-label="Produkt"
                    >
                      {produkty.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>

                  <div className="cell" data-label="Dodatek">
                    <select
                      value={line.dodatek}
                      onChange={(e) => {
                        const dodatek = e.target.value
                        const updates = { dodatek }
                        if (!needsShortSide(dodatek)) updates.shortSide = ''
                        updateLine(line.id, updates)
                      }}
                      disabled={loading}
                      aria-label="Dodatek"
                    >
                      {dodatkiList.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>

                  <div className="cell cell--dim" data-label="Szer. (mm)">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={line.width}
                      onChange={(e) => updateLine(line.id, { width: e.target.value })}
                      placeholder="mm"
                      disabled={loading}
                      aria-label="Szerokość w mm"
                    />
                  </div>

                  <div className="cell cell--dim" data-label="Wys. (mm)">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={line.height}
                      onChange={(e) => updateLine(line.id, { height: e.target.value })}
                      placeholder="mm"
                      disabled={loading}
                      aria-label="Wysokość w mm"
                    />
                  </div>

                  {showShortSideColumn && (
                    <div className="cell cell--dim" data-label="Krótki bok (mm)">
                      {lineNeedsShortSide ? (
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={line.shortSide}
                          onChange={(e) => updateLine(line.id, { shortSide: e.target.value })}
                          placeholder="mm"
                          disabled={loading}
                          aria-label="Krótki bok w mm"
                        />
                      ) : (
                        <span className="cell-placeholder" aria-hidden="true" />
                      )}
                    </div>
                  )}

                  <div className="cell cell--qty" data-label="Ilość">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={line.ilosc}
                      onChange={(e) => updateLine(line.id, { ilosc: e.target.value })}
                      disabled={loading}
                      aria-label="Ilość formatek"
                    />
                  </div>

                  <div className="cell" data-label="m²">
                    <input
                      type="text"
                      value={areaPreview != null ? formatAreaM2(areaPreview) : ''}
                      readOnly
                      placeholder="—"
                      className="input-readonly input-area"
                      aria-label="Powierzchnia m²"
                      title={
                        lineNeedsShortSide
                          ? 'Łączna powierzchnia wiersza (formatka × ilość). Próg cenowy w cenniku wg tej sumy.'
                          : 'Łączna powierzchnia wiersza (szer × wys × ilość). Próg cenowy w cenniku wg tej sumy.'
                      }
                    />
                  </div>

                  <div className="cell" data-label="Cena">
                    <input
                      type="text"
                      value={line.cena != null ? `${line.cena.toFixed(2)} zł` : ''}
                      readOnly
                      placeholder="—"
                      className="input-readonly"
                      aria-label="Cena"
                    />
                  </div>

                  <div className="cell" data-label="Tryb">
                    <select
                      value={line.tryb}
                      onChange={(e) => updateLine(line.id, { tryb: e.target.value })}
                      disabled={loading}
                      aria-label="Tryb"
                    >
                      {tryby.map((t) => (
                        <option key={t.tryb} value={t.tryb}>
                          {t.tryb}{t.procent > 0 ? ` (+${t.procent}%)` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div
                    className={`cell cell--actions${lineIndex === 0 ? ' cell--actions--start' : ''}`}
                  >
                    <button
                      type="button"
                      className="btn-row btn-row--add"
                      onClick={() => addLineAfter(line.id)}
                      disabled={loading}
                      aria-label="Dodaj wiersz"
                      title="Dodaj wiersz"
                    >
                      <PlusIcon />
                    </button>
                    {lines.length > 1 && (
                      <button
                        type="button"
                        className="btn-row btn-row--remove"
                        onClick={() => removeLine(line.id)}
                        disabled={loading}
                        aria-label="Usuń wiersz"
                        title="Usuń wiersz"
                      >
                        <MinusIcon />
                      </button>
                    )}
                  </div>
                </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleCalculate}
            disabled={loading}
          >
            {loading ? 'Przetwarzanie...' : 'Oblicz cenę'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleGenerateOffer}
            disabled={loading || !quote}
          >
            {loading ? 'Przetwarzanie...' : 'Wygeneruj ofertę'}
          </button>
          <button
            type="button"
            className="btn btn-order"
            onClick={handleShowOrderForm}
            disabled={loading || !quote}
          >
            Zamów
          </button>
          <button
            type="button"
            className="btn btn-reset"
            onClick={handleResetCennik}
            disabled={loading}
          >
            Resetuj cennik
          </button>
        </div>
      </section>

        {error && <div className="card error" role="alert">{error}</div>}
        {offerSuccess && <div className="card success" role="status">{offerSuccess}</div>}
        {orderSuccess && <div className="card success" role="status">{orderSuccess}</div>}

        {quote && (
          <section className="card result">
            <h2 className="card-title">Podsumowanie oferty</h2>

            <div className="result-meta-bar">
              <div className="result-meta-item">
                <span className="result-meta-label">Klient</span>
                <span className="result-meta-value">
                  {companyName.trim() || quote.companyName}
                </span>
              </div>
              <div className="result-meta-item">
                <span className="result-meta-label">NIP</span>
                <span className="result-meta-value">{formatNip(quote.nip)}</span>
              </div>
              {quote.procentRabatu > 0 && (
                <div className="result-meta-item">
                  <span className="result-meta-label">Rabat</span>
                  <span className="result-meta-value">{quote.procentRabatu}%</span>
                </div>
              )}
              {!quote.found && <span className="result-note">Nieznany klient</span>}
            </div>

            <div className="result-table">
              <div
                className={`result-table-row result-table-row--header${
                  quote.discountAmount > 0 ? '' : ' result-table-row--no-discount'
                }`}
              >
                <div className="result-cell result-cell--lp">Lp.</div>
                <div className="result-cell result-cell--pos">Pozycja</div>
                <div className="result-cell result-cell--dim">Wymiary</div>
                <div className="result-cell result-cell--tryb">Tryb</div>
                <div className="result-cell result-cell--price">Cena</div>
                {quote.discountAmount > 0 && (
                  <div className="result-cell result-cell--price-disc">Po rabacie</div>
                )}
              </div>

              {quote.items.map((item, i) => (
                <div
                  key={i}
                  className={`result-table-row${
                    quote.discountAmount > 0 ? '' : ' result-table-row--no-discount'
                  }`}
                >
                  <div className="result-cell result-cell--lp">{i + 1}</div>
                  <div className="result-cell result-cell--pos">
                    <span className="result-pos-main">
                      {item.rodzaj} / {item.produkt}
                    </span>
                    <span className="result-pos-sub">{item.dodatek}</span>
                  </div>
                  <div className="result-cell result-cell--dim">
                    {formatDimensions(item.width, item.height, item.shortSide)} × {item.ilosc ?? 1} szt.
                    <span className="result-pos-sub">{formatAreaM2(item.area)} m²</span>
                  </div>
                  <div className="result-cell result-cell--tryb">
                    {item.tryb}
                    {item.procent > 0 && (
                      <span className="result-pos-sub">+{item.procent}%</span>
                    )}
                  </div>
                  <div className="result-cell result-cell--price">
                    {item.lineTotal.toFixed(2)} zł
                  </div>
                  {quote.discountAmount > 0 && (
                    <div className="result-cell result-cell--price-disc">
                      {item.lineTotalAfterRabat.toFixed(2)} zł
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="result-footer">
              <div className="result-footer-rows">
                <div className="result-footer-row">
                  <span>Suma pozycji</span>
                  <span>{quote.subtotal.toFixed(2)} zł</span>
                </div>
                {quote.surcharge > 0 && (
                  <div className="result-footer-row">
                    <span>Narzut trybu</span>
                    <span>+{quote.surcharge.toFixed(2)} zł</span>
                  </div>
                )}
                {quote.discountAmount > 0 && (
                  <div className="result-footer-row">
                    <span>Rabat ({quote.procentRabatu}%)</span>
                    <span>−{quote.discountAmount.toFixed(2)} zł</span>
                  </div>
                )}
              </div>
              <div className="result-footer-total">
                <span className="result-footer-total-label">Razem do zapłaty</span>
                <span className="result-footer-total-price">
                  {quote.totalPrice.toFixed(2)} zł
                </span>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
    </div>
  )
}

export default App
