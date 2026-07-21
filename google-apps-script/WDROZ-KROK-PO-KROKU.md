# Wdrożenie Apps Script — krok po kroku

## Problem: „Stara wersja API”

Jeśli aplikacja pokazuje ten komunikat, **kod w arkuszu mógł być zmieniony, ale URL Web App nadal uruchamia starą wersję**.

Sam zapis pliku w edytorze **nie wystarczy** — trzeba wdrożyć **nową wersję**.

---

## Krok 1 — Edytor skryptu

1. Otwórz **arkusz Google** (ten z zakładkami Klienci, Cenniki…)
2. Menu: **Rozszerzenia → Apps Script**
3. Upewnij się, że jesteś w projekcie **powiązanym z tym arkuszem** (nie osobnym projektem)
4. W lewym panelu powinien być plik **Code.gs** — jeśli są inne pliki `.gs` z funkcją `doGet`, usuń je lub scal kod do jednego pliku
5. Zaznacz **całą** zawartość Code.gs i usuń
6. Wklej **całą** zawartość z pliku `google-apps-script/Code.gs` z repozytorium
7. **Zapisz** (Ctrl+S / Cmd+S)

---

## Krok 2 — Test w edytorze (opcjonalnie)

1. W edytorze Apps Script wybierz funkcję **`testDeploy`** z listy rozwijanej u góry
2. Kliknij **Wykonaj** (▶)
3. Przy pierwszym uruchomieniu: **Autoryzuj** dostęp do arkusza
4. Menu **Wykonaj** (ikona zegara) → otwórz ostatni wpis → w logu powinno być m.in. `"rodzaj":"VSG"`

Jeśli tu widać VSG — kod jest dobry, problem tylko we wdrożeniu Web App.

---

## Krok 3 — Wdrożenie Web App (najważniejsze!)

1. Kliknij **Wdróż** (Deploy) → **Zarządzaj wdrożeniami** (Manage deployments)
2. Przy wierszu typu **Aplikacja internetowa** (Web app) kliknij **ołówek** (Edytuj)
3. W polu **Wersja** wybierz z listy: **Nowa wersja** (New version) — nie zostawiaj starej wersji!
4. Kliknij **Wdróż** (Deploy)
5. Skopiuj **URL aplikacji internetowej** (kończy się na `/exec`)

---

## Krok 4 — Sprawdzenie w przeglądarce

Otwórz w nowej karcie (wklej swój URL):

```
TWOJ_URL/exec?action=ping
```

**Poprawny wynik:**
```json
{"version":2,"ok":true}
```

Potem sprawdź:
```
TWOJ_URL/exec?action=cenniki
```

**Poprawny wynik** (fragment):
```json
{
  "version": 2,
  "cenniki": [{"cennik":"Pierwszy","rodzaj":"VSG","produkt":"44.2 Float",...}],
  "dodatki": [...],
  "tryby": [...]
}
```

Jeśli nadal widzisz tylko `{"cenniki":[...]}` **bez** `"version": 2` — wdrożenie się nie udało (zły projekt lub nie wybrano „Nowa wersja”).

---

## Krok 5 — Plik .env w projekcie React

Upewnij się, że URL w `.env` jest **identyczny** z URL z kroku 3:

```
VITE_API_URL=https://script.google.com/macros/s/....../exec
VITE_USE_MOCK=false
```

Po zmianie `.env` zrestartuj serwer:
```bash
# Ctrl+C, potem:
npm run dev
```

---

## Częste błędy

| Objaw | Przyczyna |
|-------|-----------|
| Brak `"version": 2` w ping | Stara wersja Web App nadal aktywna |
| Edytujesz skrypt, ale URL bez zmian | Nie kliknięto „Nowa wersja” przy wdrożeniu |
| Dwa różne URL | Utworzono nowe wdrożenie zamiast edycji istniejącego — zaktualizuj `.env` |
| Osobny projekt Apps Script | Skrypt musi być otwarty z menu **Rozszerzenia** w arkuszu |
