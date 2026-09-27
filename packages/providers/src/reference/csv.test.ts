import { describe, expect, it } from 'vitest'
import { parseCsv, parseCsvRecords } from './csv'

describe('parseCsv', () => {
  it('tırnaklı alan, tırnak içi virgül ve satır sonu, "" kaçışı', () => {
    const text = 'a,"b, c","d ""e""","f\ng"\n1,2,3,4\n'
    expect(parseCsv(text)).toEqual([
      ['a', 'b, c', 'd "e"', 'f\ng'],
      ['1', '2', '3', '4'],
    ])
  })

  it('CRLF, BOM, boş alanlar ve sondaki satır sonu olmayan dosya', () => {
    expect(parseCsv('﻿x,,z\r\n,,\r\nq,w,e')).toEqual([
      ['x', '', 'z'],
      ['', '', ''],
      ['q', 'w', 'e'],
    ])
  })

  it('boş satırları atlar', () => {
    expect(parseCsv('a,b\n\n1,2\n\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })
})

describe('parseCsvRecords', () => {
  it('başlığa göre nesne üretir, sütun sayısı tutmayan satırı satır numarasıyla ayırır', () => {
    const { header, records, malformed } = parseCsvRecords('"id","name"\n1,"A, B"\n2\n3,C\n')
    expect(header).toEqual(['id', 'name'])
    expect(records).toEqual([
      { line: 2, values: { id: '1', name: 'A, B' } },
      { line: 4, values: { id: '3', name: 'C' } },
    ])
    expect(malformed).toEqual([3])
  })
})
