/** Testes de geometria 3D que não precisam de WebGL (usam só Vector3/MathUtils do three). */
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { parseBiblivreBackup } from '../src/lib/backup'
import { parseIso2709 } from '../src/lib/marc'
import { buildLayout } from '../src/lib/layout'
import { FILAS } from '../src/lib/sections'
import { EST_D, EST_H, EST_W, L, POST, ROOM, ROW_X0, estanteX0, rowZ, slotWorld } from '../src/three/world'
import { planPath } from '../src/three/path'

const arg = process.argv[2]
const bytes = new Uint8Array(readFileSync(arg ?? 'public/amostra.mrc'))
const books = arg ? (await parseBiblivreBackup(bytes)).books : parseIso2709(bytes).books
const lay = buildLayout(books)
let n = 0
const ok = (name: string, fn: () => void) => { fn(); n++; console.log('✓', name) }

ok('lombadas dentro do volume de cada prateleira (as duas faces) e dentro da sala', () => {
  for (const s of lay.slots) {
    const w = slotWorld(s)
    const rz = rowZ(s.fila)
    const x0 = estanteX0(s.fila, s.estante) + POST
    assert.ok(w.pos.x - s.thickness / 2 >= x0 - 1e-9 && w.pos.x + s.thickness / 2 <= x0 + L + 1e-9, `x fora: ${s.book.id}`)
    if (s.face === 'A') assert.ok(w.pos.z - s.depth / 2 >= rz + 0.02 - 1e-9 && w.pos.z + s.depth / 2 <= rz + 0.32 + 1e-9, 'face A')
    else assert.ok(w.pos.z + s.depth / 2 <= rz - 0.02 + 1e-9 && w.pos.z - s.depth / 2 >= rz - 0.32 - 1e-9, 'face B')
    assert.equal(w.normal.z, s.face === 'A' ? 1 : -1)
    assert.ok(w.pos.y - s.height / 2 >= 0.14 - 1e-9 && w.pos.y + s.height / 2 <= 1.96, `y fora: ${s.height}`)
    assert.ok(Math.abs(w.pos.x) < ROOM.w / 2 && Math.abs(w.pos.z) < ROOM.d / 2)
  }
})

ok('ordem de leitura: face A cresce em +X, face B (de costas) cresce em −X', () => {
  const by = new Map<string, typeof lay.slots>()
  for (const s of lay.slots) { const k = `${s.estante}${s.face}${s.shelf}`; (by.get(k) ?? by.set(k, []).get(k)!).push(s) }
  for (const arr of by.values()) for (let i = 1; i < arr.length; i++) {
    const a = slotWorld(arr[i - 1]).pos.x, b = slotWorld(arr[i]).pos.x
    assert.ok(arr[0].face === 'A' ? b > a : b < a)
  }
})

ok('prateleira 1 fica em cima, 5 embaixo', () => {
  const s1 = lay.slots.find((s) => s.shelf === 1)!, s5 = lay.slots.find((s) => s.shelf === 5)!
  assert.ok(slotWorld(s1).pos.y > slotWorld(s5).pos.y + 1.0)
})

ok('rota da fada nunca atravessa uma estante (320 livros × 2 pontos de partida)', () => {
  const boxes = FILAS.flatMap((f) => f.estantes.map((e) => ({ x0: estanteX0(f.n, e) - 0.1, x1: estanteX0(f.n, e) + EST_W + 0.1, z0: rowZ(f.n) - EST_D / 2 - 0.1, z1: rowZ(f.n) + EST_D / 2 + 0.1 })))
  const hit = (p: THREE.Vector3) => p.y < EST_H + 0.1 && boxes.some((b) => p.x > b.x0 && p.x < b.x1 && p.z > b.z0 && p.z < b.z1)
  const starts = [new THREE.Vector3(ROW_X0 - 3.2, 1.7, 5.4), new THREE.Vector3(2, 1.7, -2.7)]
  for (let i = 0; i < lay.slots.length; i += 13) {
    const s = lay.slots[i], w = slotWorld(s)
    for (const st of starts) {
      const pts = planPath(st, { id: 1, target: w.pos, normal: w.normal, fila: s.fila, face: s.face })
      for (let k = 1; k < pts.length; k++) for (let t = 0; t <= 1; t += 0.02) {
        const p = pts[k - 1].clone(); p.x += (pts[k].x - p.x) * t; p.y += (pts[k].y - p.y) * t; p.z += (pts[k].z - p.z) * t
        assert.ok(!hit(p), `colisão: livro ${s.book.id} fila ${s.fila} face ${s.face} em (${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)})`)
      }
      const end = pts[pts.length - 1]
      assert.ok(end.distanceTo(w.pos) < 0.6, 'fada pára a ~0,4 m da lombada')
    }
  }
})
console.log(`\n${n} testes de geometria ok`)
