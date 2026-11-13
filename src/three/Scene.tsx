import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Bloom, EffectComposer, Outline, Selection } from '@react-three/postprocessing'
import { type MutableRefObject } from 'react'
import type { Layout } from '../lib/layout'
import { Library } from './Library'
import { Books } from './Books'
import { Navi, type GuideRequest, type NaviApi } from './Navi'
import { CameraRig, type CamRequest } from './CameraRig'

export interface SceneProps {
  layout: Layout
  highlightId: string | null
  pulled: boolean
  nav: MutableRefObject<NaviApi>
  guide: GuideRequest | null
  cam: CamRequest | null
  onArrive: (id: number) => void
  onPick: (id: string) => void
  onHover: (id: string | null, x: number, y: number) => void
}

export function Scene(p: SceneProps) {
  return (
    <Canvas dpr={[1, 2]} camera={{ position: [-9.5, 6.5, 11.5], fov: 48, near: 0.05, far: 80 }} gl={{ antialias: true, powerPreference: 'high-performance' }}>
      <color attach="background" args={['#0d1117']} />
      <fog attach="fog" args={['#0d1117', 28, 70]} />
      <ambientLight intensity={0.75} />
      <hemisphereLight args={['#fff4dc', '#403525', 0.7]} />
      <directionalLight position={[4, 9, 6]} intensity={1.1} />
      <directionalLight position={[-6, 5, -5]} intensity={0.35} />

      <Selection>
        <Library layout={p.layout} />
        <Books layout={p.layout} highlightId={p.highlightId} pulled={p.pulled} onPick={p.onPick} onHover={p.onHover} />
        <Navi api={p.nav} request={p.guide} onArrive={p.onArrive} />
        <EffectComposer autoClear={false} multisampling={4}>
          <Bloom intensity={0.9} luminanceThreshold={1} luminanceSmoothing={0.2} mipmapBlur />
          <Outline blur edgeStrength={5} visibleEdgeColor={0x7df9ff} hiddenEdgeColor={0x1aa5b8} />
        </EffectComposer>
      </Selection>

      <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={0.6} maxDistance={26} maxPolarAngle={Math.PI * 0.495} target={[0, 1, 0]} />
      <CameraRig nav={p.nav} request={p.cam} />
    </Canvas>
  )
}
