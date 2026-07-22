import { API_URL_DISPLAY } from '../services/api'
import './ApiStaleWarning.css'

export default function ApiStaleWarning({
  apiDiag,
  apiDiagLoading,
  onRefresh,
  onRunDiagnostic,
}) {
  return (
    <div className="card api-warning" role="alert">
      <p>
        <strong>Stara wersja API</strong> — wdrożony skrypt nie został jeszcze zaktualizowany.
        Kod w arkuszu jest OK, ale <strong>URL Web App nadal serwuje starą wersję</strong>.
      </p>
      <ol className="api-steps">
        <li>Arkusz → <strong>Rozszerzenia → Apps Script</strong></li>
        <li>Usuń cały stary kod, wklej plik <code>google-apps-script/Code.gs</code></li>
        <li>Zapisz (Ctrl+S)</li>
        <li><strong>Wdróż → Zarządzaj wdrożeniami</strong> → ołówek przy Web App</li>
        <li>W polu „Wersja” wybierz <strong>Nowa wersja</strong> → Wdróż</li>
        <li>
          Otwórz link testowy poniżej — musi być <code>&quot;version&quot;: 3</code> i{' '}
          <code>&quot;clientRegisterOnOrder&quot;: true</code>
        </li>
      </ol>
      <p className="api-url">
        Test w przeglądarce:{' '}
        <a href={`${API_URL_DISPLAY}?action=cenniki`} target="_blank" rel="noreferrer">
          {API_URL_DISPLAY}?action=cenniki
        </a>
      </p>
      <p>
        Oczekiwany wynik zaczyna się od:{' '}
        <code>{'{"version":3,"clientRegisterOnOrder":true,"cenniki":[...'}</code>
      </p>
      <div className="api-warning-actions">
        <button type="button" className="btn btn-secondary btn-sm" onClick={onRefresh}>
          Sprawdź ponownie
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onRunDiagnostic}
          disabled={apiDiagLoading}
        >
          {apiDiagLoading ? 'Testuję…' : 'Pokaż odpowiedź API'}
        </button>
      </div>
      {apiDiag && <pre className="api-diag">{JSON.stringify(apiDiag, null, 2)}</pre>}
    </div>
  )
}
