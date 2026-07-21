import { DEFAULT_CENNIK } from '../constants'
import { parseKlienciRows, resolveClientFromKlienci } from '../utils/clientLookup'

const SHEET_ID = import.meta.env.VITE_SHEET_ID
export const USE_SHEET = Boolean(SHEET_ID)

function sheetCsvUrl(sheetName) {
  const params = new URLSearchParams({ tqx: 'out:csv', sheet: sheetName })
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?${params}`
}

function parseCsvLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result.map((cell) => cell.replace(/^"|"$/g, '').trim())
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return []

  const headers = parseCsvLine(lines[0])
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line)
    const row = {}
    headers.forEach((header, index) => {
      row[header.trim()] = cells[index] ?? ''
    })
    return row
  })
}

async function fetchSheet(sheetName) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 20000)

  try {
    const response = await fetch(sheetCsvUrl(sheetName), { signal: controller.signal })
    if (!response.ok) {
      throw new Error(`Nie udało się odczytać zakładki "${sheetName}" (${response.status})`)
    }
    return parseCsv(await response.text())
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Przekroczono czas oczekiwania na arkusz "${sheetName}". Sprawdź połączenie z internetem.`)
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}

function num(value) {
  const n = Number(String(value).replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function col(row, ...names) {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== '') return row[name]
  }
  return ''
}

export async function loadCatalogFromSheet() {
  const [cennikiRows, dodatkiRows, trybyRows] = await Promise.all([
    fetchSheet('Cenniki'),
    fetchSheet('Dodatki').catch(() => []),
    fetchSheet('Tryby').catch(() => []),
  ])

  const cenniki = cennikiRows
    .filter((row) => col(row, 'Cennik', 'cennik'))
    .map((row) => ({
      cennik: col(row, 'Cennik', 'cennik'),
      rodzaj: col(row, 'Rodzaj', 'rodzaj'),
      produkt: col(row, 'Produkt', 'produkt'),
      odM2: num(col(row, 'Od m²', 'Od m2', 'Od')),
      doM2: num(col(row, 'Do m²', 'Do m2', 'Do')),
      cena: num(col(row, 'Cena', 'cena')),
    }))

  const dodatki =
    dodatkiRows.length > 0
      ? dodatkiRows
          .filter((row) => col(row, 'Dodatek', 'dodatek'))
          .map((row) => ({
            dodatek: col(row, 'Dodatek', 'dodatek'),
            cena: num(col(row, 'Cena', 'cena')),
          }))
      : [{ dodatek: 'Brak', cena: 0 }]

  const tryby =
    trybyRows.length > 0
      ? trybyRows
          .filter((row) => col(row, 'Tryb', 'tryb'))
          .map((row) => ({
            tryb: col(row, 'Tryb', 'tryb'),
            procent: num(col(row, 'Procent', 'procent', '%')),
          }))
      : [{ tryb: 'Standard', procent: 0 }]

  return { version: 2, cenniki, dodatki, tryby }
}

export async function lookupClientFromSheet(nip) {
  const rows = await fetchSheet('Klienci')
  const parsed = parseKlienciRows(rows, col)
  const client = resolveClientFromKlienci(nip, parsed)
  return { ...client, cennik: DEFAULT_CENNIK }
}
