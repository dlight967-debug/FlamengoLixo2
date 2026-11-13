import { readFileSync } from 'node:fs'
import { parseBiblivreBackup } from '../src/lib/backup'
import { buildLayout } from '../src/lib/layout'
const { books } = await parseBiblivreBackup(new Uint8Array(readFileSync(process.argv[2])))
for (const L of [1.0, 1.2, 1.5]) {
  const lay = buildLayout(books, { shelfLength: L, gap: 0.002 })
  console.log('L=', L, 'overflow', lay.overflow.length)
  for (const s of lay.stats) console.log('  fila', s.fila, 'livros', s.books, 'm', s.meters.toFixed(1), 'cap', s.capacity.toFixed(1), 'prat', s.shelvesUsed)
}
const lay = buildLayout(books)
const cnt = new Map<string, number>()
for (const s of [...lay.slots, ...lay.overflow]) cnt.set(s.section.id, (cnt.get(s.section.id) ?? 0) + 1)
console.log([...cnt.entries()].map(([k, v]) => `${k}:${v}`).join('  '))
