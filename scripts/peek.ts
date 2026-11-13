import { readFileSync } from 'node:fs'
import { parseBiblivreBackup } from '../src/lib/backup'
const { books } = await parseBiblivreBackup(new Uint8Array(readFileSync(process.argv[2])))
const re = new RegExp(process.argv[3])
const field = process.argv[4] ?? 'cdd'
const hits = books.filter((b) => re.test(String((b as any)[field] ?? '')))
console.log(hits.length)
for (const b of hits.slice(0, +(process.argv[5] ?? 8))) console.log(b.cdd, '|', b.cutter, '|', b.author, '|', b.title, '|', b.series, '|', b.recordType, '|', b.subjects.join('; ').slice(0, 90))
