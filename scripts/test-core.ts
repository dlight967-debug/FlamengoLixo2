import { readFileSync, existsSync } from 'node:fs'
import assert from 'node:assert/strict'
import { compareCdd, parseCdd, compareCutter, parseCutter, collectionKey } from '../src/lib/cdd'
import { encodeRecord, parseIso2709, parsePages } from '../src/lib/marc'
import { classify } from '../src/lib/routing'
import { buildLayout, physicalPath } from '../src/lib/layout'
import { parseBiblivreBackup } from '../src/lib/backup'
import type { Book } from '../src/lib/types'

let n = 0
const ok = (name: string, fn: () => void) => { fn(); n++; console.log('✓', name) }

ok('CDD: ordenação decimal correta', () => {
  const v = ['363.1257', '363.12565', '363.2', '363.115', '370', '028.5', '028', '86.9', '869']
  const sorted = [...v].sort((a, b) => compareCdd(parseCdd(a), parseCdd(b)))
  assert.deepEqual(sorted, ['028', '028.5', '86.9', '363.115', '363.12565', '363.1257', '363.2', '370', '869'])
})
ok('CDD: "0.50" é lido como 050; alfanumérico vem depois dos numéricos', () => {
  assert.equal(parseCdd('0.50').int, 50)
  assert.ok(compareCdd(parseCdd('999'), parseCdd('Cart.36')) < 0)
  assert.ok(compareCdd(parseCdd('Cart.2'), parseCdd('Cart.10')) < 0)
})
ok('Cutter: B845p < B85 < B9 ; Brelaz antes de Souza', () => {
  const c = ['B9', 'B85', 'B845p', 'A12', 'S1'].sort((a, b) => compareCutter(parseCutter(a), parseCutter(b)))
  assert.deepEqual(c, ['A12', 'B845p', 'B85', 'B9', 'S1'])
})
ok('Coleção: chaves equivalentes', () => {
  assert.equal(collectionKey('Coleção Polêmica'), collectionKey('Polêmica'))
  assert.equal(collectionKey('Coleção A Obra- Prima de Cada Autor'), collectionKey('Coleção A Obra-Prima de Cada Autor'))
})
ok('Páginas', () => { assert.equal(parsePages('xii, 320 p.'), 320); assert.equal(parsePages('171p'), 171); assert.equal(parsePages(''), undefined) })

const rec = encodeRecord(
  [['001', '0004100']],
  [
    { tag: '020', sf: [['a', '9788578037215']] },
    { tag: '090', sf: [['a', '869'], ['b', 'B845p']] },
    { tag: '100', ind: '1 ', sf: [['a', 'Brelaz, Walmir Moura']] },
    { tag: '245', ind: '10', sf: [['a', 'O perdão da leitura /'], ['b', 'crônicas']] },
    { tag: '260', sf: [['a', 'Belém :'], ['b', 'Paka-Tatu,'], ['c', '2026']] },
    { tag: '300', sf: [['a', '120 p.']] },
    { tag: '650', sf: [['a', 'Leitura; Crônicas brasileiras']] },
  ],
)
ok('ISO 2709: round-trip com UTF-8 multibyte (offsets em bytes)', () => {
  const { books } = parseIso2709(rec)
  assert.equal(books.length, 1)
  const b = books[0]
  assert.equal(b.title, 'O perdão da leitura')
  assert.equal(b.cdd, '869'); assert.equal(b.cutter, 'B845p')
  assert.equal(b.isbn, '9788578037215'); assert.equal(b.place, 'Belém'); assert.equal(b.pages, 120)
  assert.equal(b.subtitle, 'crônicas')
})
ok('ISO 2709: dois registros concatenados (.mrc)', () => {
  const both = new Uint8Array(rec.length * 2); both.set(rec, 0); both.set(rec, rec.length)
  assert.equal(parseIso2709(both).books.length, 2)
})
ok('Roteamento: O perdão da leitura → Fila 3 (869, Cutter B)', () => {
  const b = parseIso2709(rec).books[0]
  const p = classify(b)
  assert.equal(p.section.id, 'f3-br')
})

const mk = (o: Partial<Book>): Book => ({ id: String(Math.random()), control: '1', cdd: '', cutter: '', author: '', title: 't', subjects: [], recordType: 'm', ...o })
ok('Roteamento: tabela', () => {
  const cases: [Partial<Book>, string][] = [
    [{ cdd: '869', cutter: 'S123a' }, 'f4-br'],
    [{ cdd: '869', cutter: 'R999x' }, 'f3-br'],
    [{ cdd: '869.8991', cutter: 'A1' }, 'f4-am-lit'],
    [{ cdd: '869.93', cutter: 'A1' }, 'f4-crit'],
    [{ cdd: '343.0946', cutter: 'B' }, 'f1-ctb'],
    [{ cdd: '343.810946', cutter: 'B' }, 'f1-ctb'],
    [{ cdd: '363.12565' }, 'f1-acid'], [{ cdd: '363.1257' }, 'f1-form'], [{ cdd: '363.2' }, 'f1-fisc'],
    [{ cdd: '372.83' }, 'f1-edu'], [{ cdd: '372.357' }, 'f3-e372'], [{ cdd: '370.16' }, 'f4-enem'],
    [{ cdd: '388' }, 'f1-388'], [{ cdd: '388', recordType: 's' }, 'f4-per388'],
    [{ cdd: '050', recordType: 's' }, 'f4-per'],
    [{ cdd: '028.5' }, 'f2-inf'], [{ cdd: '133.93' }, 'f2-rom'], [{ cdd: '158.1' }, 'f2-psi'],
    [{ cdd: '342.088' }, 'f2-dira'], [{ cdd: '981.15' }, 'f4-am-hist'], [{ cdd: '352.13' }, 'f4-am-rel'],
    [{ cdd: '658' }, 'f3-adm'], [{ cdd: '657' }, 'f3-cont'], [{ cdd: '808.07' }, 'f3-lest'],
    [{ cdd: '510.07' }, 'f3-mat'], [{ cdd: '036.9' }, 'f1-enc'], [{ cdd: '469.3' }, 'f1-dic'],
    [{ cdd: '300', subjects: ['Sociologia - Amazônia'] }, 'f4-am-ger'],
    [{ cdd: '700', subjects: ['Arte - Pará'] }, 'f4-am-cien'],
    [{ cdd: '340', subjects: ['Trânsito - Legislação'] }, 'f1-res'],
    [{ cdd: 'Cart.36' }, 'f1-388'], [{ cdd: '' }, 'f4-sem'],
    [{ cdd: '086.9', series: 'Coleção Primeiros Passos' }, 'f1-pp'],
  ]
  for (const [o, want] of cases) assert.equal(classify(mk(o)).section.id, want, JSON.stringify(o))
})
ok('Regional: "Para" (preposição) não é Pará', () => {
  assert.notEqual(classify(mk({ cdd: '300', series: 'Para gostar de ler' })).section.id, 'f4-am-ger')
})

ok('Layout: ordem CDD+Cutter e inseparabilidade de coleção', () => {
  const books = [
    mk({ id: 'a', cdd: '800', cutter: 'Z1', title: 'Z', series: 'Veredas' }),
    mk({ id: 'b', cdd: '800', cutter: 'A1', title: 'A' }),
    mk({ id: 'c', cdd: '813', cutter: 'M1', title: 'M', series: 'Veredas' }),
    mk({ id: 'd', cdd: '800', cutter: 'B1', title: 'B' }),
  ]
  const lay = buildLayout(books)
  const order = lay.slots.filter((s) => s.fila === 3).map((s) => s.book.id)
  assert.deepEqual(order, ['b', 'd', 'a', 'c']) // coleção Veredas (a,c) lado a lado; âncora = 800 Z1
  assert.equal(lay.overflow.length, 0)
})

const file = process.argv[2]
if (file && existsSync(file)) {
  const { books, report } = await parseBiblivreBackup(new Uint8Array(readFileSync(file)))
  ok(`Backup real: ${report.parsed}/${report.total} registros`, () => { assert.equal(report.skipped, 0); assert.ok(books.length > 3900) })
  const lay = buildLayout(books)
  ok('Backup real: todos os livros alocados, sem overflow', () => {
    assert.equal(lay.overflow.length, 0); assert.equal(lay.slots.length, books.length)
  })
  ok('Backup real: sem sobreposição dentro das prateleiras', () => {
    const by = new Map<string, typeof lay.slots>()
    for (const s of lay.slots) { const k = `${s.estante}${s.face}${s.shelf}`; (by.get(k) ?? by.set(k, []).get(k)!).push(s) }
    for (const arr of by.values()) {
      let end = 0
      for (const s of arr) { assert.ok(s.x >= end - 1e-9); end = s.x + s.thickness; assert.ok(end <= 1.2 + 1e-9) }
    }
  })
  ok('Backup real: ordem monotônica de seção em cada fila', () => {
    for (const f of [1, 2, 3, 4]) {
      const arr = lay.slots.filter((s) => s.fila === f)
      // a ordem física é estante → face → prateleira → x
      const phys = [...arr].sort((a, b) => a.estante - b.estante || a.face.localeCompare(b.face) || a.shelf - b.shelf || a.x - b.x)
      assert.deepEqual(phys.map((s) => s.book.id), arr.map((s) => s.book.id))
    }
  })
  ok('Backup real: coleções permanecem contíguas', () => {
    const bySeries = new Map<string, number[]>()
    lay.slots.forEach((s, i) => { if (s.groupedBy) (bySeries.get(s.groupedBy) ?? bySeries.set(s.groupedBy, []).get(s.groupedBy)!).push(i) })
    assert.ok(bySeries.size > 50)
    for (const [k, idx] of bySeries) assert.equal(idx[idx.length - 1] - idx[0], idx.length - 1, 'coleção fragmentada: ' + k)
  })
  console.log('exemplo:', physicalPath(lay.slots.find((s) => s.book.cdd === '869')!))
}
const mrc = process.argv[3]
if (mrc && existsSync(mrc)) {
  const { books, report } = parseIso2709(new Uint8Array(readFileSync(mrc)))
  ok(`.mrc exportado: ${report.parsed}/${report.total} registros relidos pelo parser ISO 2709`, () => { assert.equal(report.skipped, 0); assert.equal(books.length, 4006) })
}
const amostra = 'public/amostra.mrc'
if (existsSync(amostra)) {
  const { books } = parseIso2709(new Uint8Array(readFileSync(amostra)))
  ok(`amostra.mrc: ${books.length} registros, inclui "O perdão da leitura" em Fila 3`, () => {
    const b = books.find((x) => x.title === 'O perdão da leitura')!
    assert.ok(b); assert.equal(classify(b).section.fila, 3)
    const lay = buildLayout(books)
    assert.equal(lay.overflow.length, 0)
    assert.equal(new Set(lay.slots.map((s) => s.fila)).size, 4) // as 4 filas recebem livros
  })
}
console.log(`\n${n} testes ok`)
