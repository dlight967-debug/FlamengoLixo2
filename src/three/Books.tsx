import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Select } from '@react-three/postprocessing'
import type { Layout, Slot } from '../lib/layout'
import { hashString } from '../lib/layout'
import { parseCdd } from '../lib/cdd'
import { BOOK_PULL, slotWorld, type SlotWorld } from './world'
import { labelTexture } from './textures'

const HUES = [215, 275, 35, 195, 335, 145, 8, 300, 48, 170] // uma matiz-base por classe CDD (0xx … 9xx)

/** Cor da lombada: matiz da classe principal da CDD + variação determinística por livro. */
export function bookColor(cdd: string, id: string): THREE.Color {
  const k = parseCdd(cdd)
  const h = hashString(cdd + id)
  const hue = k.num ? HUES[Math.floor(k.int / 100) % 10] : 28
  const c = new THREE.Color()
  c.setHSL(((hue + ((h % 44) - 22) + 360) % 360) / 360, 0.38 + ((h >> 6) % 30) / 100, 0.34 + ((h >> 11) % 22) / 100)
  return c
}

const labelSize = (t: number) => {
  const w = Math.min(Math.max(t * 0.94, 0.006), 0.022)
  return { w, h: w * 3 }
}

interface BooksProps {
  layout: Layout
  highlightId?: string | null
  /** o livro já foi "puxado" para fora da prateleira? */
  pulled: boolean
  onPick: (id: string) => void
  onHover: (id: string | null, x: number, y: number) => void
}

export function Books({ layout, highlightId, pulled, onPick, onHover }: BooksProps) {
  const body = useRef<THREE.InstancedMesh>(null)
  const labels = useRef<THREE.InstancedMesh>(null)
  const worlds = useMemo<SlotWorld[]>(() => layout.slots.map(slotWorld), [layout])
  const hidden = useRef<number>(-1)
  const tmp = useMemo(() => new THREE.Object3D(), [])

  const writeInstance = (i: number, hide: boolean) => {
    const s = layout.slots[i]
    const w = worlds[i]
    if (!body.current || !labels.current) return
    tmp.rotation.set(0, 0, 0)
    tmp.position.copy(w.pos)
    tmp.scale.set(hide ? 0 : s.thickness, hide ? 0 : s.height, hide ? 0 : s.depth)
    tmp.updateMatrix()
    body.current.setMatrixAt(i, tmp.matrix)
    const { w: lw, h: lh } = labelSize(s.thickness)
    tmp.position.set(w.pos.x, w.pos.y - s.height / 2 + 0.05, w.spineZ + w.normal.z * 0.0008)
    tmp.rotation.set(0, w.normal.z > 0 ? 0 : Math.PI, 0)
    tmp.scale.set(hide ? 0 : lw, hide ? 0 : lh, 1)
    tmp.updateMatrix()
    labels.current.setMatrixAt(i, tmp.matrix)
  }

  useLayoutEffect(() => {
    if (!body.current || !labels.current) return
    layout.slots.forEach((s, i) => {
      writeInstance(i, false)
      body.current!.setColorAt(i, bookColor(s.book.cdd, s.book.id))
    })
    hidden.current = -1
    body.current.instanceMatrix.needsUpdate = true
    labels.current.instanceMatrix.needsUpdate = true
    if (body.current.instanceColor) body.current.instanceColor.needsUpdate = true
    body.current.computeBoundingSphere()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, worlds])

  // esconde a instância do livro destacado (ele é desenhado por <HighlightBook/>)
  useLayoutEffect(() => {
    if (!body.current || !labels.current) return
    if (hidden.current >= 0) writeInstance(hidden.current, false)
    const idx = highlightId ? layout.slots.findIndex((s) => s.book.id === highlightId) : -1
    if (idx >= 0) writeInstance(idx, true)
    hidden.current = idx
    body.current.instanceMatrix.needsUpdate = true
    labels.current.instanceMatrix.needsUpdate = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightId, layout, worlds])

  const handleMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    if (e.instanceId === undefined) return
    onHover(layout.slots[e.instanceId].book.id, e.nativeEvent.clientX, e.nativeEvent.clientY)
    document.body.style.cursor = 'pointer'
  }
  const handleOut = () => {
    onHover(null, 0, 0)
    document.body.style.cursor = 'auto'
  }
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 4 || e.instanceId === undefined) return // arrastou a câmera, não clicou
    e.stopPropagation()
    onPick(layout.slots[e.instanceId].book.id)
  }

  const hs = highlightId ? layout.byBookId.get(highlightId) : undefined
  const hw = hs ? worlds[layout.slots.indexOf(hs)] : undefined

  return (
    <group>
      <instancedMesh ref={body} args={[undefined, undefined, layout.slots.length]} frustumCulled={false} onPointerMove={handleMove} onPointerOut={handleOut} onClick={handleClick}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.78} metalness={0.02} flatShading />
      </instancedMesh>
      <instancedMesh ref={labels} args={[undefined, undefined, layout.slots.length]} frustumCulled={false} raycast={() => null}>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial color="#f7f7f2" roughness={0.9} />
      </instancedMesh>
      <NearbyLabels layout={layout} worlds={worlds} skipId={highlightId ?? null} />
      {hs && hw && <HighlightBook key={hs.book.id} slot={hs} world={hw} pulled={pulled} />}
    </group>
  )
}

/** Texto CDD/Cutter só nas etiquetas próximas da câmera (4 mil texturas de uma vez seriam pesadas). */
function NearbyLabels({ layout, worlds, skipId }: { layout: Layout; worlds: SlotWorld[]; skipId: string | null }) {
  const camera = useThree((s) => s.camera)
  const [near, setNear] = useState<number[]>([])
  const last = useRef(0)
  useFrame((state) => {
    if (state.clock.elapsedTime - last.current < 0.3) return
    last.current = state.clock.elapsedTime
    const cp = camera.position
    const cand: [number, number][] = []
    for (let i = 0; i < worlds.length; i++) {
      const d = worlds[i].pos.distanceToSquared(cp)
      if (d < 3.2 * 3.2) cand.push([d, i])
    }
    cand.sort((a, b) => a[0] - b[0])
    const ids = cand.slice(0, 90).map((c) => c[1])
    setNear((prev) => (prev.length === ids.length && prev.every((v, i) => v === ids[i]) ? prev : ids))
  })
  return (
    <group>
      {near.map((i) => {
        const s = layout.slots[i]
        if (s.book.id === skipId) return null
        const w = worlds[i]
        const { w: lw, h: lh } = labelSize(s.thickness)
        return (
          <mesh key={s.book.id} position={[w.pos.x, w.pos.y - s.height / 2 + 0.05, w.spineZ + w.normal.z * 0.0016]} rotation={[0, w.normal.z > 0 ? 0 : Math.PI, 0]} raycast={() => null}>
            <planeGeometry args={[lw, lh]} />
            <meshBasicMaterial map={labelTexture(s.book.cdd, s.book.cutter)} toneMapped={false} />
          </mesh>
        )
      })}
    </group>
  )
}

/** Livro localizado: desliza para fora da prateleira e brilha (emissive pulsante + outline pós-processado). */
function HighlightBook({ slot, world, pulled }: { slot: Slot; world: SlotWorld; pulled: boolean }) {
  const group = useRef<THREE.Group>(null)
  const mat = useRef<THREE.MeshStandardMaterial>(null)
  const pull = useRef(0)
  const color = useMemo(() => bookColor(slot.book.cdd, slot.book.id), [slot])
  const tex = useMemo(() => labelTexture(slot.book.cdd, slot.book.cutter), [slot])
  const { w: lw, h: lh } = labelSize(slot.thickness)

  useFrame((state, dt) => {
    pull.current = THREE.MathUtils.damp(pull.current, pulled ? BOOK_PULL : 0, 4, dt)
    if (group.current) group.current.position.set(world.pos.x, world.pos.y, world.pos.z + world.normal.z * pull.current)
    if (mat.current) mat.current.emissiveIntensity = 0.9 + Math.sin(state.clock.elapsedTime * 5) * 0.6
  })

  return (
    <group ref={group} position={world.pos}>
      <Select enabled>
        <mesh scale={[slot.thickness, slot.height, slot.depth]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial ref={mat} color={color} emissive="#35e6ff" emissiveIntensity={1} roughness={0.6} />
        </mesh>
      </Select>
      <mesh position={[0, -slot.height / 2 + 0.05, (world.normal.z > 0 ? 1 : -1) * (slot.depth / 2 + 0.0012)]} rotation={[0, world.normal.z > 0 ? 0 : Math.PI, 0]}>
        <planeGeometry args={[lw, lh]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
    </group>
  )
}
