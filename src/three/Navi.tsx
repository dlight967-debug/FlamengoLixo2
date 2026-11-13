import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { ROW_X0 } from './world'
import { planPath, type GuideRequest } from './path'
import { glowTexture, wingTexture } from './textures'

/** Estado compartilhado entre a Fada, a câmera e o App (evita re-render a 60 fps). */
export interface NaviApi {
  pos: THREE.Vector3
  vel: THREE.Vector3
  phase: 'idle' | 'flying' | 'arrived'
  /** enquadramento final da câmera para o livro alvo */
  frameCam: THREE.Vector3
  frameLook: THREE.Vector3
}
export type { GuideRequest }
export const createNaviApi = (): NaviApi => ({
  pos: new THREE.Vector3(ROW_X0 - 3.2, 1.7, 5.4),
  vel: new THREE.Vector3(),
  phase: 'idle',
  frameCam: new THREE.Vector3(),
  frameLook: new THREE.Vector3(),
})

const SPEED = 3.0
const TRAIL = 70
const easeInOut = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2

interface NaviProps {
  api: MutableRefObject<NaviApi>
  request: GuideRequest | null
  onArrive: (id: number) => void
}

export function Navi({ api, request, onArrive }: NaviProps) {
  const root = useRef<THREE.Group>(null)
  const wingL = useRef<THREE.Mesh>(null)
  const wingR = useRef<THREE.Mesh>(null)
  const flight = useRef<{ curve: THREE.CatmullRomCurve3; u: number; dur: number; id: number } | null>(null)
  const prev = useRef(new THREE.Vector3())
  const wing = useMemo(() => wingTexture(), [])
  const glow = useMemo(() => glowTexture(), [])

  // trilha de partículas
  const trail = useMemo(() => {
    const pos = new Float32Array(TRAIL * 3)
    const col = new Float32Array(TRAIL * 3)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return g
  }, [])
  const trailPts = useRef<THREE.Vector3[]>(Array.from({ length: TRAIL }, () => api.current.pos.clone()))

  useEffect(() => {
    if (!request) return
    const pts = planPath(api.current.pos, request)
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal')
    flight.current = { curve, u: 0, dur: Math.max(2.4, curve.getLength() / SPEED), id: request.id }
    api.current.phase = 'flying'
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.id])

  useFrame((state, dt) => {
    const a = api.current
    const t = state.clock.elapsedTime
    const g = root.current
    if (!g) return
    dt = Math.min(dt, 0.05)

    const f = flight.current
    if (f && a.phase === 'flying') {
      f.u = Math.min(1, f.u + dt / f.dur)
      prev.current.copy(a.pos)
      a.pos.copy(f.curve.getPointAt(easeInOut(f.u)))
      a.vel.lerp(a.pos.clone().sub(prev.current).divideScalar(Math.max(dt, 1e-4)), 0.15)
      if (f.u >= 1) {
        a.phase = 'arrived'
        a.vel.set(0, 0, 0)
        onArrive(f.id)
      }
    } else {
      a.vel.multiplyScalar(0.9)
    }

    // pairar: pequena órbita + oscilação vertical
    const hover = a.phase !== 'flying' ? 1 : 0.25
    g.position.set(a.pos.x + Math.cos(t * 1.7) * 0.03 * hover, a.pos.y + Math.sin(t * 2.3) * 0.045 * hover, a.pos.z + Math.sin(t * 1.7) * 0.03 * hover)
    const flap = Math.sin(t * 38) * 0.75
    if (wingL.current) wingL.current.rotation.set(0, 0, 0.5 + flap)
    if (wingR.current) wingR.current.rotation.set(0, 0, -0.5 - flap)

    // trilha
    const tp = trailPts.current
    for (let i = TRAIL - 1; i > 0; i--) tp[i].copy(tp[i - 1])
    tp[0].copy(g.position)
    const pa = trail.getAttribute('position') as THREE.BufferAttribute
    const ca = trail.getAttribute('color') as THREE.BufferAttribute
    for (let i = 0; i < TRAIL; i++) {
      const jitter = (i / TRAIL) * 0.05
      pa.setXYZ(i, tp[i].x + (Math.random() - 0.5) * jitter, tp[i].y + (Math.random() - 0.5) * jitter, tp[i].z + (Math.random() - 0.5) * jitter)
      const k = Math.pow(1 - i / TRAIL, 2.2) * (a.phase === 'flying' ? 1 : 0.45)
      ca.setXYZ(i, 0.35 * k * 2.2, 0.95 * k * 2.2, 1.0 * k * 2.2)
    }
    pa.needsUpdate = true
    ca.needsUpdate = true
  })

  return (
    <>
      <group ref={root}>
        {/* núcleo luminoso (cor > 1 para o Bloom pegar) */}
        <mesh>
          <sphereGeometry args={[0.045, 16, 16]} />
          <meshBasicMaterial color={new THREE.Color(1.6, 3.2, 3.8)} toneMapped={false} />
        </mesh>
        <sprite scale={[0.42, 0.42, 1]}>
          <spriteMaterial map={glow} color="#7df9ff" transparent opacity={0.85} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </sprite>
        {/* asas */}
        <mesh ref={wingL} position={[-0.05, 0.03, 0]}>
          <planeGeometry args={[0.1, 0.2]} />
          <meshBasicMaterial map={wing} transparent depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
        <mesh ref={wingR} position={[0.05, 0.03, 0]}>
          <planeGeometry args={[0.1, 0.2]} />
          <meshBasicMaterial map={wing} transparent depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
        <pointLight color="#7df9ff" intensity={3.2} distance={3.5} decay={2} />
      </group>
      <points geometry={trail} frustumCulled={false}>
        <pointsMaterial size={0.055} vertexColors transparent depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation toneMapped={false} />
      </points>
    </>
  )
}
