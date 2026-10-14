import * as THREE from 'three'

// 16x16 픽셀 텍스처를 모아 하나의 아틀라스(4열 x 3행 = 12칸)로 만든다.
// 외부 이미지 없이 코드로 픽셀아트를 생성한다.

export const TILE_SIZE = 16
export const ATLAS_COLS = 4
export const ATLAS_ROWS = 3

// 타일 인덱스
export const TILE = {
  GRASS_TOP: 0,
  GRASS_SIDE: 1,
  DIRT: 2,
  STONE: 3,
  SAND: 4,
  LOG_TOP: 5,
  LOG_SIDE: 6,
  LEAVES: 7,
  PLANK: 8,
  COBBLE: 9,
  BRICK: 10,
  WATER: 11,
}

// 결정론적 난수 (같은 텍스처가 매번 동일하게 나오도록)
function makeRng(seed) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

function hexToRgb(hex) {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255]
}

// 기본색 + 픽셀 노이즈로 타일을 채운다.
function paintNoise(ctx, x0, y0, baseHex, jitter, seed) {
  const rng = makeRng(seed)
  const [r, g, b] = hexToRgb(baseHex)
  for (let y = 0; y < TILE_SIZE; y += 1) {
    for (let x = 0; x < TILE_SIZE; x += 1) {
      const n = (rng() - 0.5) * jitter
      ctx.fillStyle = `rgb(${clamp255(r + n)}, ${clamp255(g + n)}, ${clamp255(b + n)})`
      ctx.fillRect(x0 + x, y0 + y, 1, 1)
    }
  }
}

function clamp255(v) {
  return Math.max(0, Math.min(255, Math.round(v)))
}

function paintRect(ctx, x0, y0, x, y, w, h, color) {
  ctx.fillStyle = color
  ctx.fillRect(x0 + x, y0 + y, w, h)
}

function paintPixel(ctx, x0, y0, x, y, color) {
  ctx.fillStyle = color
  ctx.fillRect(x0 + x, y0 + y, 1, 1)
}

// 타일 하나를 그린다.
function paintTile(ctx, index, x0, y0) {
  switch (index) {
    case TILE.GRASS_TOP:
      paintNoise(ctx, x0, y0, 0x6ab04c, 34, 11)
      for (let i = 0; i < 22; i += 1) {
        const rng = makeRng(300 + i)
        const x = Math.floor(rng() * TILE_SIZE)
        const y = Math.floor(rng() * TILE_SIZE)
        paintPixel(ctx, x0, y0, x, y, i % 3 === 0 ? '#7ec850' : '#569a3c')
      }
      break
    case TILE.GRASS_SIDE:
      paintNoise(ctx, x0, y0, 0x8b5a2b, 30, 12)
      for (let x = 0; x < TILE_SIZE; x += 1) {
        const rng = makeRng(500 + x)
        const depth = 3 + Math.floor(rng() * 3)
        for (let y = 0; y < depth; y += 1) {
          paintPixel(ctx, x0, y0, x, y, y === 0 ? '#7ec850' : '#6ab04c')
        }
      }
      break
    case TILE.DIRT:
      paintNoise(ctx, x0, y0, 0x8b5a2b, 30, 13)
      for (let i = 0; i < 18; i += 1) {
        const rng = makeRng(700 + i)
        paintPixel(
          ctx,
          x0,
          y0,
          Math.floor(rng() * TILE_SIZE),
          Math.floor(rng() * TILE_SIZE),
          '#6f4620',
        )
      }
      break
    case TILE.STONE:
      paintNoise(ctx, x0, y0, 0x9a9a9a, 26, 14)
      for (let i = 0; i < 16; i += 1) {
        const rng = makeRng(900 + i)
        paintPixel(
          ctx,
          x0,
          y0,
          Math.floor(rng() * TILE_SIZE),
          Math.floor(rng() * TILE_SIZE),
          '#7d7d7d',
        )
      }
      break
    case TILE.SAND:
      paintNoise(ctx, x0, y0, 0xe6d5a3, 20, 15)
      break
    case TILE.LOG_TOP:
      paintNoise(ctx, x0, y0, 0xb98a4a, 18, 16)
      // 나이테
      ctx.strokeStyle = '#8a6431'
      ctx.lineWidth = 1
      for (let r = 2; r <= 6; r += 2) {
        ctx.beginPath()
        ctx.arc(x0 + 8, y0 + 8, r, 0, Math.PI * 2)
        ctx.stroke()
      }
      paintRect(ctx, x0, y0, 7, 7, 2, 2, '#6f4e2a')
      break
    case TILE.LOG_SIDE:
      paintNoise(ctx, x0, y0, 0x6f4e2a, 22, 17)
      for (let x = 2; x < TILE_SIZE; x += 5) {
        paintRect(ctx, x0, y0, x, 0, 1, TILE_SIZE, '#5b3f22')
      }
      break
    case TILE.LEAVES:
      paintNoise(ctx, x0, y0, 0x3f8f3a, 40, 18)
      for (let i = 0; i < 30; i += 1) {
        const rng = makeRng(1100 + i)
        paintPixel(
          ctx,
          x0,
          y0,
          Math.floor(rng() * TILE_SIZE),
          Math.floor(rng() * TILE_SIZE),
          i % 2 === 0 ? '#2f6f2b' : '#4fa348',
        )
      }
      break
    case TILE.PLANK:
      paintNoise(ctx, x0, y0, 0xc08b4a, 20, 19)
      for (let y = 3; y < TILE_SIZE; y += 4) {
        paintRect(ctx, x0, y0, 0, y, TILE_SIZE, 1, '#8f6432')
      }
      paintRect(ctx, x0, y0, 5, 0, 1, TILE_SIZE, '#a5763c')
      break
    case TILE.COBBLE:
      paintNoise(ctx, x0, y0, 0x8a8a8a, 24, 20)
      for (let i = 0; i < 7; i += 1) {
        const rng = makeRng(1300 + i)
        const x = Math.floor(rng() * 12)
        const y = Math.floor(rng() * 12)
        paintRect(ctx, x0, y0, x, y, 3, 2, '#6d6d6d')
      }
      break
    case TILE.BRICK:
      paintNoise(ctx, x0, y0, 0xb04a3a, 18, 21)
      // 줄눈
      ctx.fillStyle = '#d9c7a0'
      for (let y = 0; y < TILE_SIZE; y += 8) {
        ctx.fillRect(x0, y0 + y, TILE_SIZE, 1)
      }
      for (let y = 0; y < TILE_SIZE; y += 16) {
        for (let x = 0; x < TILE_SIZE; x += 8) {
          ctx.fillRect(x0 + x + 7, y0 + y, 1, 8)
        }
      }
      for (let y = 8; y < TILE_SIZE; y += 16) {
        for (let x = 0; x < TILE_SIZE; x += 8) {
          ctx.fillRect(x0 + x + 3, y0 + y, 1, 8)
        }
      }
      break
    case TILE.WATER:
      paintNoise(ctx, x0, y0, 0x3d7ad6, 18, 22)
      break
    default:
      break
  }
}

let atlasCanvas = null

function getAtlasCanvas() {
  if (atlasCanvas) return atlasCanvas
  const canvas = document.createElement('canvas')
  canvas.width = ATLAS_COLS * TILE_SIZE
  canvas.height = ATLAS_ROWS * TILE_SIZE
  const ctx = canvas.getContext('2d')
  const total = ATLAS_COLS * ATLAS_ROWS
  for (let i = 0; i < total; i += 1) {
    const col = i % ATLAS_COLS
    const row = Math.floor(i / ATLAS_COLS)
    paintTile(ctx, i, col * TILE_SIZE, row * TILE_SIZE)
  }
  atlasCanvas = canvas
  return canvas
}

export function createAtlasTexture() {
  const texture = new THREE.CanvasTexture(getAtlasCanvas())
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  texture.generateMipmaps = false
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

// 아틀라스에서 타일 하나의 UV 사각형을 계산한다.
export function tileUV(index) {
  const col = index % ATLAS_COLS
  const row = Math.floor(index / ATLAS_COLS)
  const iw = 1 / ATLAS_COLS
  const ih = 1 / ATLAS_ROWS
  const inset = 0.0015
  return {
    u0: col * iw + inset,
    u1: (col + 1) * iw - inset,
    // flipY 때문에 텍스처의 위쪽이 v1
    v1: 1 - row * ih - inset,
    v0: 1 - (row + 1) * ih + inset,
  }
}

// UI(핫바)에서 쓰기 위한 타일 미리보기 dataURL
export function tileDataURL(index, scale = 3) {
  const src = getAtlasCanvas()
  const col = index % ATLAS_COLS
  const row = Math.floor(index / ATLAS_COLS)
  const out = document.createElement('canvas')
  out.width = TILE_SIZE * scale
  out.height = TILE_SIZE * scale
  const ctx = out.getContext('2d')
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(
    src,
    col * TILE_SIZE,
    row * TILE_SIZE,
    TILE_SIZE,
    TILE_SIZE,
    0,
    0,
    out.width,
    out.height,
  )
  return out.toDataURL()
}

// 블록 정의: 면 그룹별 타일 인덱스
export const BLOCKS = {
  1: { name: '잔디', tiles: { top: TILE.GRASS_TOP, side: TILE.GRASS_SIDE, bottom: TILE.DIRT } },
  2: { name: '흙', tiles: { top: TILE.DIRT, side: TILE.DIRT, bottom: TILE.DIRT } },
  3: { name: '돌', tiles: { top: TILE.STONE, side: TILE.STONE, bottom: TILE.STONE } },
  4: { name: '모래', tiles: { top: TILE.SAND, side: TILE.SAND, bottom: TILE.SAND } },
  5: { name: '원목', tiles: { top: TILE.LOG_TOP, side: TILE.LOG_SIDE, bottom: TILE.LOG_TOP } },
  6: { name: '나뭇잎', tiles: { top: TILE.LEAVES, side: TILE.LEAVES, bottom: TILE.LEAVES } },
  7: { name: '나무판자', tiles: { top: TILE.PLANK, side: TILE.PLANK, bottom: TILE.PLANK } },
  8: { name: '조약돌', tiles: { top: TILE.COBBLE, side: TILE.COBBLE, bottom: TILE.COBBLE } },
  9: { name: '벽돌', tiles: { top: TILE.BRICK, side: TILE.BRICK, bottom: TILE.BRICK } },
}

export const HOTBAR = [1, 2, 3, 4, 5, 6, 7, 8, 9]
