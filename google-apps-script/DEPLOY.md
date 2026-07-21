# Wdrożenie Google Apps Script

## 1. Zakładki w arkuszu

Utwórz **5 zakładek**:

| Zakładka     | Opis |
|--------------|------|
| `Klienci`    | NIP → przypisany cennik |
| `Cenniki`    | Ceny produktów (za m²) per rodzaj |
| `Dodatki`    | Wspólna lista dodatków ze stałą ceną |
| `Tryby`      | Narzut % od całego zamówienia |
| `Zamówienia` | Historia złożonych zamówień |

## 2. Struktura danych

### Klienci

| NIP        | Nazwa   | Cennik |
|------------|---------|--------|
| 5261040828 | Firma A | A      |
| 7740001454 | Firma B | VIP    |

### Cenniki — ceny produktów

Każdy wiersz = cena **za m²** dla kombinacji: cennik klienta + **rodzaj** + **produkt** + zakres m².

Rodzaj (np. VSG, ESG) determinuje listę dostępnych produktów w aplikacji.

| Cennik  | Rodzaj | Produkt   | Od m² | Do m² | Cena |
|---------|--------|-----------|-------|-------|------|
| DEFAULT | VSG    | VSG 6mm   | 1     | 50    | 95   |
| DEFAULT | VSG    | VSG 8mm   | 1     | 50    | 110  |
| DEFAULT | VSG    | VSG 10mm  | 1     | 50    | 125  |
| DEFAULT | ESG    | ESG 6mm   | 1     | 50    | 85   |
| DEFAULT | ESG    | ESG 8mm   | 1     | 50    | 98   |
| DEFAULT | ESG    | ESG 10mm  | 1     | 50    | 112  |
| A       | VSG    | VSG 6mm   | 1     | 50    | 90   |
| VIP     | ESG    | ESG 6mm   | 1     | 50    | 80   |

### Dodatki — wspólna lista

Ta sama lista i ceny dla **wszystkich** rodzajów i produktów. Cena dodatku **dokłada się** do ceny pozycji (kwota stała, nie za m²).

| Dodatek   | Cena |
|-----------|------|
| Brak      | 0    |
| Matowanie | 25   |
| Druk      | 40   |
| Otwory    | 15   |

### Tryby — narzut od całego zamówienia

| Tryb     | Procent |
|----------|---------|
| Standard | 0       |
| Express  | 10      |
| Montaż   | 15      |

### Zamówienia

| Data | NIP | Nazwa firmy | Rodzaj | Produkt | Dodatek | Tryb | Procent trybu | m² | Cennik użyty | Cena łączna |

## 3. Logika liczenia (w aplikacji)

```
Cena pozycji = (cena produktu za m² × ilość m²) + cena dodatku
Suma pozycji = Σ cen pozycji
Razem        = suma pozycji × (1 + procent trybu / 100)
```

## 4. API

```
GET <URL>?action=cenniki
```

Odpowiedź:
```json
{
  "cenniki": [{ "cennik": "DEFAULT", "rodzaj": "VSG", "produkt": "VSG 6mm", "odM2": 1, "doM2": 50, "cena": 95 }],
  "dodatki": [{ "dodatek": "Brak", "cena": 0 }, { "dodatek": "Matowanie", "cena": 25 }],
  "tryby": [{ "tryb": "Standard", "procent": 0 }]
}
```

## 5. Wdrożenie

1. Wklej `google-apps-script/Code.gs`
2. Wdróż Web App (dostęp: **Każdy**)
3. Po zmianach: **Nowa wersja** wdrożenia
