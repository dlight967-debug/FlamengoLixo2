import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { FILAS, SECTIONS } from '../lib/sections'
import type { Layout, FaceInfo } from '../lib/layout'
import { EST_D, EST_H, EST_W, L, POST, BOARD_T, LEVEL_H, BASE_Y, ROOM, ROW_LEN, ROW_X0, estanteX0, rowZ, FACE_D } from './world'
import { canvasTexture, fitText } from './textures'

type Box = { p: [number, number, number]; s: [number, number, number] }

function Boxes({ items, color, metalness = 0.4, roughness = 0.55, emissive }: { items: Box[]; color: string; metalness?: number; roughness?: number; emissive?: string }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const o = new THREE.Object3D()
    items.forEach((it, i) => {
      o.position.set(...it.p)
      o.scale.set(...it.s)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    })
    m.instanceMatrix.needsUpdate = true
    m.computeBoundingSphere()
  }, [items])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} flatShading emissive={emissive ?? '#000000'} emissiveIntensity={emissive ? 1 : 0} />
    </instancedMesh>
  )
}

/** Estantes de aço dupla face: 4 colunas, 6 chapas por face (= 5 prateleiras) e painel central. */
function Estantes() {
  const { steel, accent, panel } = useMemo(() => {
    const steel: Box[] = []
    const panel: Box[] = []
    const accent: Record<number, Box[]> = { 1: [], 2: [], 3: [], 4: [] }
    for (const f of FILAS) {
      for (const est of f.estantes) {
        const x0 = estanteX0(f.n, est)
        const cx = x0 + EST_W / 2
        const z0 = rowZ(f.n)
        // colunas
        for (const dx of [POST / 2, EST_W - POST / 2])
          for (const dz of [-EST_D / 2 + 0.02, EST_D / 2 - 0.02]) accent[f.n].push({ p: [x0 + dx, EST_H / 2, z0 + dz], s: [0.045, EST_H, 0.045] })
        // chapas (6 níveis por face)
        for (const sign of [1, -1])
          for (let i = 0; i <= 5; i++)
            steel.push({ p: [cx, BASE_Y + i * LEVEL_H + BOARD_T / 2, z0 + sign * (0.02 + FACE_D / 2)], s: [EST_W - 0.01, BOARD_T, FACE_D] })
        // painel central + travessa superior
        panel.push({ p: [cx, EST_H / 2, z0], s: [EST_W - 0.01, EST_H, 0.02] })
        accent[f.n].push({ p: [cx, EST_H + 0.01, z0], s: [EST_W, 0.04, EST_D] })
        // rodapé
        steel.push({ p: [cx, BASE_Y / 2, z0], s: [EST_W - 0.02, BASE_Y, EST_D - 0.04] })
      }
    }
    return { steel, accent, panel }
  }, [])
  return (
    <>
      <Boxes items={steel} color="#7b8896" />
      <Boxes items={panel} color="#56626f" />
      {FILAS.map((f) => (
        <Boxes key={f.n} items={accent[f.n]} color={f.color} metalness={0.2} />
      ))}
    </>
  )
}

function Room() {
  const floorTex = useMemo(
    () =>
      canvasTexture(256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#b9a98c'
        ctx.fillRect(0, 0, w, h)
        ctx.strokeStyle = 'rgba(70,55,35,0.28)'
        ctx.lineWidth = 3
        ctx.strokeRect(0, 0, w, h)
        ctx.fillStyle = 'rgba(255,255,255,0.05)'
        ctx.fillRect(0, 0, w / 2, h / 2)
        ctx.fillRect(w / 2, h / 2, w / 2, h / 2)
      }),
    [],
  )
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping
  floorTex.repeat.set(ROOM.w / 1.2, ROOM.d / 1.2)
  const hw = ROOM.w / 2
  const hd = ROOM.d / 2
  const wall = '#ece3cf'
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[ROOM.w, ROOM.d]} />
        <meshStandardMaterial map={floorTex} roughness={0.9} />
      </mesh>
      {/* paredes voltadas para dentro (invisíveis vistas de fora) */}
      <mesh position={[0, ROOM.h / 2, -hd]}>
        <planeGeometry args={[ROOM.w, ROOM.h]} />
        <meshStandardMaterial color={wall} />
      </mesh>
      <mesh position={[0, ROOM.h / 2, hd]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[ROOM.w, ROOM.h]} />
        <meshStandardMaterial color={wall} />
      </mesh>
      <mesh position={[-hw, ROOM.h / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[ROOM.d, ROOM.h]} />
        <meshStandardMaterial color="#e3d8c0" />
      </mesh>
      <mesh position={[hw, ROOM.h / 2, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[ROOM.d, ROOM.h]} />
        <meshStandardMaterial color={wall} />
      </mesh>
      {/* rodapé */}
      <Boxes
        color="#6b5a45"
        metalness={0}
        items={[
          { p: [0, 0.06, -hd + 0.02], s: [ROOM.w, 0.12, 0.04] },
          { p: [0, 0.06, hd - 0.02], s: [ROOM.w, 0.12, 0.04] },
          { p: [-hw + 0.02, 0.06, 0], s: [0.04, 0.12, ROOM.d] },
          { p: [hw - 0.02, 0.06, 0], s: [0.04, 0.12, ROOM.d] },
        ]}
      />
      {/* porta de entrada (parede −X) */}
      <mesh position={[-hw + 0.03, 1.05, 5.6]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[1.1, 2.1, 0.05]} />
        <meshStandardMaterial color="#7a4f2b" roughness={0.7} />
      </mesh>
      {/* vigas do teto onde as placas ficam penduradas */}
      <Boxes
        color="#4a4036"
        metalness={0}
        items={[
          { p: [ROW_X0 - 0.45, ROOM.h - 0.06, 0], s: [0.1, 0.12, ROOM.d - 0.4] },
          { p: [-ROW_X0 + 0.45, ROOM.h - 0.06, 0], s: [0.1, 0.12, ROOM.d - 0.4] },
        ]}
      />
      {/* luminárias de teto (emissivas) */}
      <Boxes
        color="#fffbe9"
        emissive="#fff3c4"
        metalness={0}
        items={[-2, -0.4, 1.2, 2.8].flatMap((z) => [-4.5, 0, 4.5].map((x): Box => ({ p: [x, ROOM.h - 0.04, rowZ(2.5) + z * 1.3], s: [1.6, 0.05, 0.22] })))}
      />
    </group>
  )
}

/** Sinalização da cabeceira da fila: nome do bloco + faixas de CDD. */
function rowSignTexture(fila: (typeof FILAS)[number]) {
  const secs = SECTIONS.filter((s) => s.fila === fila.n)
  return canvasTexture(1500, 560, (ctx, w, h) => {
    ctx.fillStyle = '#10161e'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = fila.color
    ctx.fillRect(0, 0, w, 22)
    ctx.fillRect(0, h - 22, w, 22)
    // número grande
    ctx.fillStyle = fila.color
    ctx.font = '700 300px Fraunces, Georgia, serif'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(String(fila.n), 50, 330)
    ctx.fillStyle = '#f5ecd7'
    ctx.font = '600 56px Inter, system-ui, sans-serif'
    ctx.fillText(`FILA ${fila.n}`, 250, 120)
    const s = fitText(ctx, fila.sign, 1150, 110, '800')
    ctx.font = `800 ${s}px Inter, system-ui, sans-serif`
    ctx.fillText(fila.sign, 250, 235)
    ctx.fillStyle = '#a8b3c0'
    fitText(ctx, fila.name, 1150, 52, '500')
    ctx.fillText(fila.name, 250, 305)
    // faixas de CDD em colunas
    const perCol = Math.ceil(secs.length / 3)
    ctx.font = '500 24px Inter, system-ui, sans-serif'
    secs.forEach((sec, i) => {
      const col = Math.floor(i / perCol)
      const row = i % perCol
      const x = 40 + col * 485
      const y = 370 + row * 28
      ctx.fillStyle = fila.color
      ctx.fillText(sec.range.length > 15 ? sec.range.slice(0, 15) : sec.range, x, y)
      ctx.fillStyle = '#d8dfe7'
      const label = sec.label.length > 30 ? sec.label.slice(0, 29) + '…' : sec.label
      ctx.fillText(label, x + 150, y)
    })
  })
}

function RowSigns() {
  const tex = useMemo(() => FILAS.map(rowSignTexture), [])
  const W = 2.55
  const H = W * (560 / 1500)
  const y = ROOM.h - 0.12 - H / 2 - 0.35
  return (
    <group>
      {FILAS.map((f, i) => {
        const z = rowZ(f.n)
        return [-1, 1].map((side) => {
          const x = side < 0 ? ROW_X0 - 0.45 : -ROW_X0 + 0.45
          const rot = side < 0 ? -Math.PI / 2 : Math.PI / 2 // voltada para o corredor transversal
          return (
            <group key={`${f.n}-${side}`} position={[x, y, z]} rotation={[0, rot, 0]}>
              <mesh>
                <boxGeometry args={[W + 0.06, H + 0.06, 0.04]} />
                <meshStandardMaterial color="#222a33" />
              </mesh>
              <mesh position={[0, 0, 0.022]}>
                <planeGeometry args={[W, H]} />
                <meshBasicMaterial map={tex[i]} toneMapped={false} />
              </mesh>
              {[-0.9, 0.9].map((dx) => (
                <mesh key={dx} position={[dx, H / 2 + (ROOM.h - 0.12 - y - H / 2) / 2, 0]}>
                  <cylinderGeometry args={[0.012, 0.012, ROOM.h - 0.12 - y - H / 2, 6]} />
                  <meshStandardMaterial color="#9aa5b1" metalness={0.7} roughness={0.4} />
                </mesh>
              ))}
            </group>
          )
        })
      })}
    </group>
  )
}

function estanteSignTexture(fila: (typeof FILAS)[number], info: FaceInfo) {
  return canvasTexture(900, 230, (ctx, w, h) => {
    ctx.fillStyle = '#10161e'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = fila.color
    ctx.fillRect(0, 0, 16, h)
    ctx.fillStyle = '#f5ecd7'
    ctx.textBaseline = 'alphabetic'
    ctx.font = '800 64px Inter, system-ui, sans-serif'
    ctx.fillText(`ESTANTE ${info.estante}`, 40, 76)
    ctx.font = '600 34px Inter, system-ui, sans-serif'
    ctx.fillStyle = fila.color
    ctx.fillText(info.face === 'A' ? 'FRENTE · face A' : 'VERSO · face B', 560, 70)
    ctx.fillStyle = '#e6edf5'
    if (info.first && info.last) {
      const a = `${info.first.book.cdd} ${info.first.book.cutter}`.trim()
      const b = `${info.last.book.cdd} ${info.last.book.cutter}`.trim()
      const line = `${a}  →  ${b}`
      fitText(ctx, line, w - 70, 52, '700')
      ctx.fillText(line, 40, 140)
      ctx.fillStyle = '#a8b3c0'
      const names = info.sections.slice(0, 3).map((s) => s.label).join(' · ')
      fitText(ctx, names, w - 70, 30, '500')
      ctx.fillText(names, 40, 195)
    } else {
      ctx.fillStyle = '#7d8896'
      ctx.font = '500 40px Inter, system-ui, sans-serif'
      ctx.fillText('(vazia)', 40, 150)
    }
  })
}

function EstanteSigns({ layout }: { layout: Layout }) {
  const items = useMemo(
    () =>
      layout.faces.map((info) => {
        const fila = FILAS.find((f) => f.estantes.includes(info.estante as never))!
        return { info, fila, tex: estanteSignTexture(fila, info) }
      }),
    [layout],
  )
  const W = EST_W - 0.04
  const H = W * (230 / 900)
  return (
    <group>
      {items.map(({ info, fila, tex }) => {
        const x = estanteX0(fila.n, info.estante) + EST_W / 2
        const z = rowZ(fila.n) + (info.face === 'A' ? 1 : -1) * (EST_D / 2 + 0.012)
        return (
          <group key={`${info.estante}${info.face}`} position={[x, EST_H + 0.06 + H / 2 + 0.04, z]} rotation={[0, info.face === 'A' ? 0 : Math.PI, 0]}>
            <mesh>
              <planeGeometry args={[W, H]} />
              <meshBasicMaterial map={tex} toneMapped={false} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

export function Library({ layout }: { layout: Layout }) {
  return (
    <group>
      <Room />
      <Estantes />
      <RowSigns />
      <EstanteSigns layout={layout} />
    </group>
  )
}

export { ROW_LEN, LEVEL_H }
