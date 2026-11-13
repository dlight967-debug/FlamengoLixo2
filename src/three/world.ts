import * as THREE from 'three'
import { FILAS } from '../lib/sections'
import { DEFAULT_CONFIG, type Slot } from '../lib/layout'

/** Todas as medidas em metros. +Z = lado "Frente" (face A); −Z = lado "Verso" (face B). */
export const L = DEFAULT_CONFIG.shelfLength
export const POST = 0.03
export const EST_W = L + POST * 2
export const FACE_D = 0.3
export const EST_D = 0.64
export const EST_H = 2.0
export const BOARD_T = 0.02
export const LEVEL_H = 0.36
export const BASE_Y = 0.12
export const ROW_LEN = EST_W * 3
export const ROW_X0 = -ROW_LEN / 2
export const ROW_PITCH = 2.7
export const FRONT_EDGE = 0.31 // lombada encostada na borda frontal da prateleira
export const ROOM = { w: 15, d: 15.5, h: 3.3 }

export const rowZ = (fila: number) => (fila - 2.5) * ROW_PITCH
export const estanteIndex = (fila: number, estante: number) => FILAS[fila - 1].estantes.indexOf(estante as never)
export const estanteX0 = (fila: number, estante: number) => ROW_X0 + estanteIndex(fila, estante) * EST_W

export interface SlotWorld {
  pos: THREE.Vector3 // centro do livro
  normal: THREE.Vector3 // direção para o corredor
  spineZ: number
}

export function slotWorld(s: Slot): SlotWorld {
  const ex = estanteX0(s.fila, s.estante) + POST
  const z0 = rowZ(s.fila)
  const level = 5 - s.shelf // 0 = prateleira de baixo
  const y = BASE_Y + level * LEVEL_H + BOARD_T + s.height / 2
  if (s.face === 'A') {
    return {
      pos: new THREE.Vector3(ex + s.x + s.thickness / 2, y, z0 + FRONT_EDGE - s.depth / 2),
      normal: new THREE.Vector3(0, 0, 1),
      spineZ: z0 + FRONT_EDGE,
    }
  }
  return {
    pos: new THREE.Vector3(ex + L - s.x - s.thickness / 2, y, z0 - FRONT_EDGE + s.depth / 2),
    normal: new THREE.Vector3(0, 0, -1),
    spineZ: z0 - FRONT_EDGE,
  }
}

/** z do centro do corredor à frente de uma face. */
export const aisleZ = (fila: number, face: 'A' | 'B') => rowZ(fila) + (face === 'A' ? 1 : -1) * (EST_D / 2 + (ROW_PITCH - EST_D) / 2)

export const BOOK_PULL = 0.12
