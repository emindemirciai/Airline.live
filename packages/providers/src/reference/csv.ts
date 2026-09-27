/**
 * RFC 4180 CSV ayrıştırıcı: tırnaklı alanlar, tırnak içinde virgül ve satır sonu, "" kaçışı,
 * CRLF/LF satır sonları ve dosya başındaki BOM. OurAirports ve VRS standing-data dosyaları için.
 */
export function parseCsv(text: string): string[][] {
  return [...iterateCsv(text)]
}

/**
 * Satırları tek tek üretir; büyük dosyada (OurAirports airports.csv ~12 MB) bütün satırlar aynı
 * anda bellekte tutulmaz, çağıran yalnızca işine yarayanları saklar. Boş satırlar atlanır.
 */
export function* iterateCsv(text: string): Generator<string[]> {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0
  while (i < source.length) {
    const char = source[i]
    if (inQuotes) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
      } else {
        field += char
      }
      i += 1
      continue
    }
    if (char === '"' && field === '') {
      inQuotes = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      row.push(field)
      if (!isBlank(row)) yield row
      row = []
      field = ''
      if (char === '\r' && source[i + 1] === '\n') i += 1
    } else {
      field += char
    }
    i += 1
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    if (!isBlank(row)) yield row
  }
}

const isBlank = (row: string[]) => row.length === 1 && row[0] === ''

export interface CsvRecord {
  /** Kayıt sırası (başlık 1 sayılır); tırnak içi satır sonu olan dosyalarda fiziksel satır değildir. */
  line: number
  values: Record<string, string>
}

/** Sütun sayısı başlıkla uyuşmayan kayıt `values: null` ile gelir. */
export interface CsvRecordOrMalformed {
  line: number
  values: Record<string, string> | null
}

/** Başlık satırına göre kayıtları tek tek üretir (bkz. `iterateCsv`). */
export function* iterateCsvRecords(text: string): Generator<CsvRecordOrMalformed> {
  let header: string[] | null = null
  let line = 1
  for (const row of iterateCsv(text)) {
    if (header === null) {
      header = row
      continue
    }
    line += 1
    if (row.length !== header.length) {
      yield { line, values: null }
      continue
    }
    const values: Record<string, string> = {}
    header.forEach((name, column) => {
      values[name] = row[column] ?? ''
    })
    yield { line, values }
  }
}

/** Başlık satırına göre kayıtlar. Sütun sayısı başlıkla uyuşmayan satırlar `malformed`'a gider. */
export function parseCsvRecords(text: string): {
  header: string[]
  records: CsvRecord[]
  malformed: number[]
} {
  const header = iterateCsv(text).next().value ?? []
  const records: CsvRecord[] = []
  const malformed: number[] = []
  for (const { line, values } of iterateCsvRecords(text)) {
    if (values) records.push({ line, values })
    else malformed.push(line)
  }
  return { header, records, malformed }
}
