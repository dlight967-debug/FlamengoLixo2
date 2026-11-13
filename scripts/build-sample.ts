/**
 * Gera public/amostra.mrc (≈3 obras por seção + "O perdão da leitura") e, opcionalmente,
 * acervo-completo.mrc (ISO 2709 com todos os registros ativos) a partir de um backup .b5bz.
 *   npm run sample -- caminho/Biblivre_Backup.b5bz [saida-completo.mrc]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { extractRawRecords } from '../src/lib/backup'
import { parseRecord, recordToBook } from '../src/lib/marc'
import { classify } from '../src/lib/routing'
import { BRELAZ } from '../src/lib/loader'

const [, , file, fullOut] = process.argv
const raws = await extractRawRecords(new Uint8Array(readFileSync(file)))
const perSection = new Map<string, number>()
const chosen: Uint8Array[] = []
for (const r of raws) {
  const b = recordToBook(parseRecord(r.iso), r.id)
  const sid = classify(b).section.id
  const n = perSection.get(sid) ?? 0
  if (n < 3 && (b.pages || sid.includes('388') || sid === 'f1-388')) { perSection.set(sid, n + 1); chosen.push(r.iso) }
}
chosen.push(BRELAZ())
const cat = (parts: Uint8Array[]) => { const o = new Uint8Array(parts.reduce((s, p) => s + p.length, 0)); let p = 0; for (const x of parts) { o.set(x, p); p += x.length } return o }
writeFileSync('public/amostra.mrc', cat(chosen))
console.log(`amostra.mrc: ${chosen.length} registros em ${perSection.size} seções`)
if (fullOut) { writeFileSync(fullOut, cat(raws.map((r) => r.iso))); console.log(`${fullOut}: ${raws.length} registros`) }
