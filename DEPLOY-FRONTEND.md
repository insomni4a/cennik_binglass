# Wdrożenie frontendu (React)

Frontend to statyczna aplikacja Vite — możesz ją hostować na Vercel, Netlify lub innym hostingu statycznym.

## Wymagania wstępne

1. Wdrożony Google Apps Script (patrz `google-apps-script/DEPLOY.md`).
2. Konto na [GitHub](https://github.com) z repozytorium tego projektu.
3. Skopiowany URL API (kończy się na `/exec`).

## Konfiguracja zmiennych środowiskowych

W panelu hostingu ustaw:

| Zmienna          | Wartość                                      |
|------------------|----------------------------------------------|
| `VITE_API_URL`   | URL wdrożonego Apps Script (`.../exec`)      |
| `VITE_USE_MOCK`  | `false` (w produkcji)                         |

> Vite wstrzykuje zmienne `VITE_*` w czasie **buildu**. Po zmianie URL API trzeba przebudować i wdrożyć ponownie.

---

## Opcja A: Vercel

1. Wejdź na [vercel.com](https://vercel.com) i zaloguj się przez GitHub.
2. **Add New → Project** → wybierz repozytorium `cennik_binglass`.
3. Ustawienia buildu (Vercel wykryje Vite automatycznie):
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. W sekcji **Environment Variables** dodaj:
   - `VITE_API_URL` = twój URL Apps Script
   - `VITE_USE_MOCK` = `false`
5. Kliknij **Deploy**.

Po wdrożeniu otrzymasz adres typu `https://cennik-binglass.vercel.app`.

### Aktualizacja

Każdy push na branch `main` automatycznie przebudowuje aplikację (jeśli włączony auto-deploy).

---

## Opcja B: Netlify

1. Wejdź na [netlify.com](https://netlify.com) i zaloguj się przez GitHub.
2. **Add new site → Import an existing project** → wybierz repozytorium.
3. Ustawienia buildu:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
4. **Site settings → Environment variables**:
   - `VITE_API_URL` = twój URL Apps Script
   - `VITE_USE_MOCK` = `false`
5. Kliknij **Deploy site**.

### Plik konfiguracyjny (opcjonalnie)

Możesz dodać `netlify.toml` w katalogu głównym:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

Redirect zapewnia poprawne działanie SPA przy bezpośrednim wejściu na podstrony (przydatne przy rozbudowie).

---

## Opcja C: Ręczne wdrożenie (bez CI)

```bash
# 1. Ustaw zmienne w .env
echo "VITE_API_URL=https://script.google.com/macros/s/TWOJ_ID/exec" > .env
echo "VITE_USE_MOCK=false" >> .env

# 2. Zbuduj
npm run build

# 3. Wgraj folder dist/ na dowolny hosting statyczny
#    (np. Firebase Hosting, GitHub Pages, własny serwer nginx)
```

---

## Test końcowy (checklist)

- [ ] Wpisz NIP `526-104-08-28` → cennik **A**, Firma A
- [ ] Wpisz NIP `774-000-14-54` → cennik **VIP**, Firma B
- [ ] Wpisz nieznany NIP (np. `701-000-18-55`) → cennik **DEFAULT**
- [ ] Oblicz cenę dla 15 m² / Float 40
- [ ] Złóż zamówienie → nowy wiersz w arkuszu „Zamówienia”
- [ ] Sprawdź walidację: błędny NIP pokazuje komunikat o sumie kontrolnej

---

## Rozwiązywanie problemów

| Problem | Rozwiązanie |
|---------|-------------|
| „Nie udało się pobrać cenników” | Sprawdź `VITE_API_URL`, dostęp Web App (Anyone), nowe wdrożenie GAS |
| CORS / błąd fetch | Apps Script musi być wdrożony jako Web App z dostępem „Każdy” |
| POST nie zapisuje zamówienia | Autoryzuj skrypt ponownie; sprawdź nagłówki arkusza „Zamówienia” |
| Stare dane po zmianie arkusza | Odśwież stronę — cenniki ładują się przy starcie aplikacji |
