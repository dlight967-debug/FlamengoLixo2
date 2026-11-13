import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, type MutableRefObject } from 'react'
import * as THREE from 'three'
import type { NaviApi } from './Navi'

export type CamRequest =
  | { id: number; kind: 'guide' }
  | { id: number; kind: 'pose'; pos: THREE.Vector3; look: THREE.Vector3 }

interface Props {
  nav: MutableRefObject<NaviApi>
  request: CamRequest | null
}

type Mode = 'free' | 'follow' | 'frame'

/**
 * Câmera em "smooth damp": segue a Fada durante o voo e enquadra a prateleira ao chegar.
 * Ao terminar (ou ao usuário tocar na cena) devolve o controle ao OrbitControls sem salto.
 */
export function CameraRig({ nav, request }: Props) {
  const { camera, gl } = useThree()
  const controls = useThree((s) => s.controls) as unknown as { enabled: boolean; target: THREE.Vector3; update: () => void } | null
  const mode = useRef<Mode>('free')
  const look = useRef(new THREE.Vector3(0, 1, 0))
  const goalPos = useRef(new THREE.Vector3())
  const goalLook = useRef(new THREE.Vector3())
  const settle = useRef(0)
  const dir = useRef(new THREE.Vector3(1, 0, 0))

  const release = () => {
    if (mode.current === 'free') return
    mode.current = 'free'
    if (controls) {
      controls.target.copy(look.current)
      controls.enabled = true
      controls.update()
    }
  }

  useEffect(() => {
    if (!request || !controls) return
    look.current.copy(controls.target)
    controls.enabled = false
    settle.current = 0
    if (request.kind === 'guide') {
      mode.current = 'follow'
    } else {
      goalPos.current.copy(request.pos)
      goalLook.current.copy(request.look)
      mode.current = 'frame'
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.id])

  // o usuário interveio: devolve o controle imediatamente
  useEffect(() => {
    const el = gl.domElement
    const stop = () => release()
    el.addEventListener('pointerdown', stop)
    el.addEventListener('wheel', stop, { passive: true })
    return () => {
      el.removeEventListener('pointerdown', stop)
      el.removeEventListener('wheel', stop)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, controls])

  useFrame((_, dtRaw) => {
    if (mode.current === 'free') return
    const dt = Math.min(dtRaw, 0.05)
    const n = nav.current
    let lambda = 2.4

    if (mode.current === 'follow') {
      if (n.phase === 'arrived') {
        goalPos.current.copy(n.frameCam)
        goalLook.current.copy(n.frameLook)
        mode.current = 'frame'
        settle.current = 0
      } else {
        if (n.vel.lengthSq() > 0.05) dir.current.lerp(n.vel.clone().normalize(), 0.08).normalize()
        goalPos.current.copy(n.pos).addScaledVector(dir.current, -2.9).add(new THREE.Vector3(0, 0.55, 0))
        goalLook.current.copy(n.pos).addScaledVector(dir.current, 0.9)
        lambda = 2.0
      }
    }
    if (mode.current === 'frame') {
      lambda = 2.8
      settle.current += dt
    }

    const c = camera.position
    c.x = THREE.MathUtils.damp(c.x, goalPos.current.x, lambda, dt)
    c.y = THREE.MathUtils.damp(c.y, goalPos.current.y, lambda, dt)
    c.z = THREE.MathUtils.damp(c.z, goalPos.current.z, lambda, dt)
    const l = look.current
    l.x = THREE.MathUtils.damp(l.x, goalLook.current.x, lambda + 0.4, dt)
    l.y = THREE.MathUtils.damp(l.y, goalLook.current.y, lambda + 0.4, dt)
    l.z = THREE.MathUtils.damp(l.z, goalLook.current.z, lambda + 0.4, dt)
    camera.lookAt(l)

    if (mode.current === 'frame' && settle.current > 0.8 && c.distanceTo(goalPos.current) < 0.03) release()
  })

  return null
}
