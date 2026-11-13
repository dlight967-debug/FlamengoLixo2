import * as THREE from 'three'
import { aisleZ, ROW_X0 } from './world'

export interface GuideRequest {
  id: number
  target: THREE.Vector3 // centro do livro
  normal: THREE.Vector3 // para o corredor
  fila: number
  face: 'A' | 'B'
}

const CRUISE_Y = 1.75
/** Rota pelos corredores: sobe → corredor transversal → corredor da fila → aproxima do livro. */
export function planPath(from: THREE.Vector3, req: GuideRequest): THREE.Vector3[] {
  const approach = req.target.clone().addScaledVector(req.normal, 0.42)
  approach.y = THREE.MathUtils.clamp(req.target.y, 0.45, 1.9)
  const az = aisleZ(req.fila, req.face)
  const xCross = from.x < 0 ? ROW_X0 - 1.4 : -ROW_X0 + 1.4
  const raw = [
    from.clone(),
    new THREE.Vector3(from.x, CRUISE_Y, from.z),
    new THREE.Vector3(xCross, CRUISE_Y, from.z),
    new THREE.Vector3(xCross, CRUISE_Y, az),
    new THREE.Vector3(approach.x, CRUISE_Y, az),
    new THREE.Vector3(approach.x, (CRUISE_Y + approach.y) / 2, (az + approach.z) / 2),
    approach,
  ]
  const pts: THREE.Vector3[] = []
  for (const p of raw) if (!pts.length || pts[pts.length - 1].distanceTo(p) > 0.15) pts.push(p)
  if (pts.length < 2) pts.push(pts[0].clone().add(new THREE.Vector3(0, 0.01, 0)))
  return pts
}

