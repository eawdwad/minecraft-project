import * as THREE from 'three'
import { BLOCKS, tileUV } from './textures'

export const WORLD_X = 64
export const WORLD_Y = 32
export const WORLD_Z = 64
export const CHUNK_SIZE = 16

const CHUNKS_X = Math.ceil(WORLD_X / CHUNK_SIZE)
const CHUNKS_Z = Math.ceil(WORLD_Z / CHUNK_SIZE)

const index = (x, y, z) => (y * WORLD_Z + z) * WORLD_X + x

// ------------------------------------------------------------------ 노이즈

function hash2(x, z, seed = 0) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263) + Math.imul(seed | 0, 362437)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

function valueNoise(x, z) {
  const xi = Math.floor(x)
  const zi = Math.floor(z)
  const xf = x - xi
  const zf = z - zi
  const u = xf * xf * (3 - 2 * xf)
  const v = zf * zf * (3 - 2 * zf)
  const a = hash2(xi, zi, 1)
  const b = hash2(xi + 1, zi, 1)
  const c = hash2(xi, zi + 1, 1)
  const d = hash2(xi + 1, zi + 1, 1)
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v
}

function fbm(x, z) {
  return valueNoise(x, z) * 0.6 + valueNoise(x * 2, z * 2) * 0.3 + valueNoise(x * 4, z * 4) * 0.1
}

// ------------------------------------------------------------------ 월드

export class World {
  constructor() {
    this.data = new Uint8Array(WORLD_X * WORLD_Y * WORLD_Z)
  }

  inBounds(x, y, z) {
    return x >= 0 && x < WORLD_X && y >= 0 && y < WORLD_Y && z >= 0 && z < WORLD_Z
  }

  get(x, y, z) {
    if (!this.inBounds(x, y, z)) return 0
    return this.data[index(x, y, z)]
  }

  set(x, y, z, id) {
    if (!this.inBounds(x, y, z)) return
    this.data[index(x, y, z)] = id
  }

  // 충돌/메시 컬링용: 월드 밖(아래/옆)은 단단한 것으로 취급한다.
  isSolid(x, y, z) {
    if (y < 0) return true
    if (y >= WORLD_Y) return false
    if (x < 0 || x >= WORLD_X || z < 0 || z >= WORLD_Z) return true
    return this.data[index(x, y, z)] !== 0
  }

  surfaceHeight(x, z) {
    for (let y = WORLD_Y - 1; y >= 0; y -= 1) {
      if (this.get(x, y, z) !== 0) return y + 1
    }
    return 1
  }
}

function placeTree(world, x, z) {
  const base = world.surfaceHeight(x, z) - 1
  if (base < 1) return
  const trunk = 4 + Math.floor(hash2(x, z, 7) * 2)
  const top = base + trunk
  for (let i = 1; i <= trunk; i += 1) world.set(x, base + i, z, 5)

  for (let dx = -2; dx <= 2; dx += 1) {
    for (let dz = -2; dz <= 2; dz += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        const dist = Math.abs(dx) + Math.abs(dz) + Math.abs(dy)
        if (dist > 3) continue
        const lx = x + dx
        const ly = top + dy
        const lz = z + dz
        if (world.get(lx, ly, lz) === 0) world.set(lx, ly, lz, 6)
      }
    }
  }
}

export function generateTerrain(world) {
  for (let x = 0; x < WORLD_X; x += 1) {
    for (let z = 0; z < WORLD_Z; z += 1) {
      const n = fbm(x / 18, z / 18)
      const h = Math.floor(6 + n * 16)
      for (let y = 0; y <= h; y += 1) {
        let id = 3 // 돌
        if (y === h) id = h <= 7 ? 4 : 1 // 낮으면 모래, 아니면 잔디
        else if (y > h - 4) id = 2 // 흙
        world.set(x, y, z, id)
      }
    }
  }

  // 맨 아래 bedrock 층
  for (let x = 0; x < WORLD_X; x += 1) {
    for (let z = 0; z < WORLD_Z; z += 1) {
      world.set(x, 0, z, 14)
    }
  }

  // 광물 매장 (돌 블록만 교체, 깊을수록 희귀 광물)
  for (let x = 0; x < WORLD_X; x += 1) {
    for (let z = 0; z < WORLD_Z; z += 1) {
      for (let y = 1; y < WORLD_Y; y += 1) {
        if (world.get(x, y, z) !== 3) continue
        const r = hash2(x * 7 + y * 131, z * 5 + y * 97, 555)
        if (y <= 9 && r < 0.004) world.set(x, y, z, 13) // 다이아몬드
        else if (y <= 13 && r < 0.011) world.set(x, y, z, 12) // 금
        else if (y <= 18 && r < 0.024) world.set(x, y, z, 11) // 철
        else if (y <= 24 && r < 0.045) world.set(x, y, z, 10) // 석탄
      }
    }
  }

  // 나무 심기
  for (let x = 2; x < WORLD_X - 2; x += 1) {
    for (let z = 2; z < WORLD_Z - 2; z += 1) {
      if (hash2(x * 3 + 7, z * 5 + 11, 99) < 0.012) {
        placeTree(world, x, z)
      }
    }
  }
}

// ------------------------------------------------------------------ 메시

const FACE_SHADE = {
  top: 1.0,
  bottom: 0.5,
  x: 0.82,
  z: 0.68,
}

// 정육면체 6면. corners는 바깥에서 봤을 때 CCW 순서.
const FACES = [
  {
    dir: [1, 0, 0],
    shade: FACE_SHADE.x,
    corners: [
      [1, 0, 1],
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
    ],
    uv: [
      [1, 0],
      [0, 0],
      [0, 1],
      [1, 1],
    ],
  },
  {
    dir: [-1, 0, 0],
    shade: FACE_SHADE.x,
    corners: [
      [0, 0, 0],
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
    ],
    uv: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
  },
  {
    dir: [0, 1, 0],
    group: 'top',
    shade: FACE_SHADE.top,
    corners: [
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
      [0, 1, 0],
    ],
    uv: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
  },
  {
    dir: [0, -1, 0],
    group: 'bottom',
    shade: FACE_SHADE.bottom,
    corners: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ],
    uv: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
  },
  {
    dir: [0, 0, 1],
    shade: FACE_SHADE.z,
    corners: [
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
    ],
    uv: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
  },
  {
    dir: [0, 0, -1],
    shade: FACE_SHADE.z,
    corners: [
      [1, 0, 0],
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
    ],
    uv: [
      [1, 0],
      [0, 0],
      [0, 1],
      [1, 1],
    ],
  },
]

function faceGroup(face) {
  if (face.group) return face.group
  return 'side'
}

// 청크 하나의 지오메트리를 만든다. (보이는 면만)
export function buildChunkGeometry(world, cx, cz) {
  const positions = []
  const normals = []
  const uvs = []
  const colors = []
  const indices = []
  let vertexCount = 0

  const x0 = cx * CHUNK_SIZE
  const z0 = cz * CHUNK_SIZE

  for (let x = x0; x < x0 + CHUNK_SIZE; x += 1) {
    for (let z = z0; z < z0 + CHUNK_SIZE; z += 1) {
      for (let y = 0; y < WORLD_Y; y += 1) {
        const id = world.get(x, y, z)
        if (id === 0) continue
        const def = BLOCKS[id]
        if (!def) continue

        for (const face of FACES) {
          const [dx, dy, dz] = face.dir
          if (world.isSolid(x + dx, y + dy, z + dz)) continue

          const group = faceGroup(face)
          const tile = def.tiles[group]
          const rect = tileUV(tile)

          for (let i = 0; i < 4; i += 1) {
            const c = face.corners[i]
            positions.push(x + c[0], y + c[1], z + c[2])
            normals.push(dx, dy, dz)
            const [uu, vv] = face.uv[i]
            uvs.push(uu ? rect.u1 : rect.u0, vv ? rect.v1 : rect.v0)
            colors.push(face.shade, face.shade, face.shade)
          }

          indices.push(vertexCount, vertexCount + 1, vertexCount + 2)
          indices.push(vertexCount, vertexCount + 2, vertexCount + 3)
          vertexCount += 4
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  return geometry
}

export { CHUNKS_X, CHUNKS_Z }
