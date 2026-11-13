import { readFileSync } from 'node:fs'
import { parseBiblivreBackup } from '../src/lib/backup'
const f = process.argv[2]
const { books, report, library } = await parseBiblivreBackup(new Uint8Array(readFileSync(f)))
console.log(library, report)
const c = new Map<string, number>()
for (const b of books) c.set(b.cdd, (c.get(b.cdd) ?? 0) + 1)
console.log('cdd distintos', c.size)
console.log([...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, 80).map(([k, v]) => `${k}:${v}`).join('  '))
const s = new Map<string, number>()
for (const b of books) if (b.series) s.set(b.series, (s.get(b.series) ?? 0) + 1)
console.log('series', s.size, [...s.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25))
console.log('sem cdd', books.filter((b) => !b.cdd).length, 'sem cutter', books.filter((b) => !b.cutter).length, 'sem paginas', books.filter((b) => !b.pages).length)
console.log('tipos', [...new Set(books.map((b) => b.recordType))])
console.log(books.find((b) => b.cdd === 'Cartilha') ?? books.find(b=>/^car/i.test(b.cdd)))
console.log(books.find((b) => /^fol/i.test(b.cdd)))
