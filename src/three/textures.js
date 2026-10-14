import * as THREE from 'three'

// 16x16 픽셀 텍스처 아틀라스 (8열 x 5행 = 40칸)
// 외부 이미지 없이 코드로 픽셀아트를 생성한다.

export const TILE_SIZE = 16
export const ATLAS_COLS = 8
export const ATLAS_ROWS = 5

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
  COAL_ORE: 12,
  IRON_ORE: 13,
  GOLD_ORE: 14,
  DIAMOND_ORE: 15,
  BEDROCK: 16,
  STICK: 17,
  COAL: 18,
  IRON_INGOT: 19,
  GOLD_INGOT: 20,
  DIAMOND: 21,
  PICK_WOOD: 22,
  PICK_STONE: 23,
  PICK_IRON: 24,
  PICK_DIAMOND: 25,
  AXE_WOOD: 26,
  AXE_STONE: 27,
  AXE_IRON: 28,
  AXE_DIAMOND: 29,
  SHOVEL_WOOD: 30,
  SHOVEL_STONE: 31,
  SHOVEL_IRON: 32,
  SHOVEL_DIAMOND: 33,
}

function makeRng(seed) {
  let state = (seed * 2654435761) >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

const clamp255 = (v) => Math.max(0, Math.min(255, Math.round(v)))
const hexToRgb = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255]

function paintNoise(ctx, x0, y0, baseHex, jitter, seed) {
  const rng = makeRng(seed + 1)
  const [r, g, b] = hexToRgb(baseHex)
  for (let y = 0; y < TILE_SIZE; y += 1) {
    for (let x = 0; x < TILE_SIZE; x += 1) {
      const n = (rng() - 0.5) * jitter
      ctx.fillStyle = `rgb(${clamp255(r + n)}, ${clamp255(g + n)}, ${clamp255(b + n)})`
      ctx.fillRect(x0 + x, y0 + y, 1, 1)
    }
  }
}

function pixel(ctx, x0, y0, x, y, color) {
  ctx.fillStyle = color
  ctx.fillRect(x0 + x, y0 + y, 1, 1)
}

function rect(ctx, x0, y0, x, y, w, h, color) {
  ctx.fillStyle = color
  ctx.fillRect(x0 + x, y0 + y, w, h)
}

// ------------------------------------------------------------- 블록 타일

function paintOre(ctx, x0, y0, oreColor, seed) {
  paintNoise(ctx, x0, y0, 0x9a9a9a, 26, seed)
  const rng = makeRng(seed + 3)
  const spots = [
    [3, 3],
    [10, 4],
    [5, 10],
    [11, 11],
    [8, 7],
  ]
  for (const [sx, sy] of spots) {
    rect(ctx, x0, y0, sx, sy, 2, 2, oreColor)
  }
  for (let i = 0; i < 8; i += 1) {
    pixel(ctx, x0, y0, Math.floor(rng() * 16), Math.floor(rng() * 16), oreColor)
  }
}

function paintBedrock(ctx, x0, y0) {
  paintNoise(ctx, x0, y0, 0x4a4a4a, 46, 60)
  const rng = makeRng(61)
  for (let i = 0; i < 12; i += 1) {
    const x = Math.floor(rng() * 14)
    const y = Math.floor(rng() * 14)
    rect(ctx, x0, y0, x, y, 2, 2, i % 2 === 0 ? '#2f2f2f' : '#636363')
  }
}

function paintGrassTop(ctx, x0, y0) {
  paintNoise(ctx, x0, y0, 0x6ab04c, 34, 11)
  const rng = makeRng(120)
  for (let i = 0; i < 24; i += 1) {
    pixel(ctx, x0, y0, Math.floor(rng() * 16), Math.floor(rng() * 16), i % 3 === 0 ? '#7ec850' : '#569a3c')
  }
}

function paintGrassSide(ctx, x0, y0) {
  paintNoise(ctx, x0, y0, 0x8b5a2b, 30, 12)
  for (let x = 0; x < TILE_SIZE; x += 1) {
    const rng = makeRng(500 + x)
    const depth = 3 + Math.floor(rng() * 3)
    for (let y = 0; y < depth; y += 1) {
      pixel(ctx, x0, y0, x, y, y === 0 ? '#7ec850' : '#6ab04c')
    }
  }
}

// ------------------------------------------------------------- 아이템 아이콘

function drawHandle(ctx, x0, y0) {
  for (let i = 0; i < 7; i += 1) {
    pixel(ctx, x0, y0, 4 + i, 13 - i, '#7a5230')
    pixel(ctx, x0, y0, 5 + i, 13 - i, '#5e3f24')
  }
}

function drawPickaxe(ctx, x0, y0, head) {
  drawHandle(ctx, x0, y0)
  for (let x = 3; x <= 12; x += 1) {
    const t = (x - 3) / 9
    const y = 8 - Math.round(4 * Math.sin(Math.PI * t))
    pixel(ctx, x0, y0, x, y, head)
    pixel(ctx, x0, y0, x, y + 1, head)
  }
}

function drawAxe(ctx, x0, y0, head) {
  drawHandle(ctx, x0, y0)
  const blade = [
    [8, 3],
    [9, 3],
    [10, 4],
    [11, 5],
    [11, 6],
    [11, 7],
    [10, 8],
    [9, 8],
    [8, 7],
    [8, 6],
    [8, 5],
    [8, 4],
  ]
  for (const [x, y] of blade) pixel(ctx, x0, y0, x, y, head)
  pixel(ctx, x0, y0, 9, 4, '#ffffff')
  pixel(ctx, x0, y0, 10, 5, '#ffffff')
}

function drawShovel(ctx, x0, y0, head) {
  drawHandle(ctx, x0, y0)
  for (let y = 3; y <= 7; y += 1) {
    for (let x = 8; x <= 11; x += 1) {
      const corner = (x === 8 || x === 11) && (y === 3 || y === 7)
      if (corner) continue
      pixel(ctx, x0, y0, x, y, head)
    }
  }
  pixel(ctx, x0, y0, 9, 4, '#ffffff')
}

const TOOL_HEAD = {
  wood: '#a5763c',
  stone: '#c9c9c9',
  iron: '#eaeaea',
  diamond: '#57e6d8',
}

function paintStick(ctx, x0, y0) {
  for (let i = 0; i < 8; i += 1) {
    pixel(ctx, x0, y0, 4 + i, 12 - i, '#7a5230')
    pixel(ctx, x0, y0, 5 + i, 12 - i, '#5e3f24')
  }
}

function paintIngot(ctx, x0, y0, color, light, dark) {
  const rows = [
    [7, 4, 6, 9],
    [8, 5, 5, 10],
    [9, 6, 4, 11],
  ]
  for (const [y, , xStart, xEnd] of rows) {
    for (let x = xStart; x <= xEnd; x += 1) pixel(ctx, x0, y0, x, y, color)
  }
  for (let x = 6; x <= 9; x += 1) pixel(ctx, x0, y0, x, 6, light)
  for (let x = 4; x <= 11; x += 1) pixel(ctx, x0, y0, x, 10, dark)
}

function paintCoal(ctx, x0, y0) {
  const blob = [
    [6, 5], [7, 5], [8, 5], [9, 5],
    [5, 6], [6, 6], [7, 6], [8, 6], [9, 6], [10, 6],
    [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7],
    [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8],
    [6, 9], [7, 9], [8, 9], [9, 9],
    [7, 10], [8, 10],
  ]
  for (const [x, y] of blob) pixel(ctx, x0, y0, x, y, '#2f2f2f')
  pixel(ctx, x0, y0, 6, 6, '#5a5a5a')
  pixel(ctx, x0, y0, 7, 6, '#5a5a5a')
  pixel(ctx, x0, y0, 6, 7, '#4a4a4a')
}

function paintDiamond(ctx, x0, y0) {
  const rows = [
    [4, 6, 9],
    [5, 5, 10],
    [6, 4, 11],
    [7, 5, 10],
    [8, 6, 9],
    [9, 7, 8],
  ]
  for (const [y, a, b] of rows) {
    for (let x = a; x <= b; x += 1) pixel(ctx, x0, y0, x, y, '#3fb8e0')
  }
  pixel(ctx, x0, y0, 7, 5, '#9df0ff')
  pixel(ctx, x0, y0, 7, 6, '#9df0ff')
  pixel(ctx, x0, y0, 8, 6, '#9df0ff')
}

// ------------------------------------------------------------- 타일 그리기

function paintTile(ctx, index, x0, y0) {
  switch (index) {
    case TILE.GRASS_TOP: paintGrassTop(ctx, x0, y0); break
    case TILE.GRASS_SIDE: paintGrassSide(ctx, x0, y0); break
    case TILE.DIRT:
      paintNoise(ctx, x0, y0, 0x8b5a2b, 30, 13)
      break
    case TILE.STONE:
      paintNoise(ctx, x0, y0, 0x9a9a9a, 26, 14)
      break
    case TILE.SAND:
      paintNoise(ctx, x0, y0, 0xe6d5a3, 20, 15)
      break
    case TILE.LOG_TOP: {
      paintNoise(ctx, x0, y0, 0xb98a4a, 18, 16)
      ctx.strokeStyle = '#8a6431'
      ctx.lineWidth = 1
      for (let r = 2; r <= 6; r += 2) {
        ctx.beginPath()
        ctx.arc(x0 + 8, y0 + 8, r, 0, Math.PI * 2)
        ctx.stroke()
      }
      rect(ctx, x0, y0, 7, 7, 2, 2, '#6f4e2a')
      break
    }
    case TILE.LOG_SIDE:
      paintNoise(ctx, x0, y0, 0x6f4e2a, 22, 17)
      for (let x = 2; x < TILE_SIZE; x += 5) rect(ctx, x0, y0, x, 0, 1, TILE_SIZE, '#5b3f22')
      break
    case TILE.LEAVES: {
      paintNoise(ctx, x0, y0, 0x3f8f3a, 40, 18)
      const rng = makeRng(210)
      for (let i = 0; i < 30; i += 1) {
        pixel(ctx, x0, y0, Math.floor(rng() * 16), Math.floor(rng() * 16), i % 2 === 0 ? '#2f6f2b' : '#4fa348')
      }
      break
    }
    case TILE.PLANK:
      paintNoise(ctx, x0, y0, 0xc08b4a, 20, 19)
      for (let y = 3; y < TILE_SIZE; y += 4) rect(ctx, x0, y0, 0, y, TILE_SIZE, 1, '#8f6432')
      rect(ctx, x0, y0, 5, 0, 1, TILE_SIZE, '#a5763c')
      break
    case TILE.COBBLE: {
      paintNoise(ctx, x0, y0, 0x8a8a8a, 24, 20)
      const rng = makeRng(220)
      for (let i = 0; i < 8; i += 1) {
        rect(ctx, x0, y0, Math.floor(rng() * 12), Math.floor(rng() * 12), 3, 2, '#6d6d6d')
      }
      break
    }
    case TILE.BRICK:
      paintNoise(ctx, x0, y0, 0xb04a3a, 18, 21)
      for (let y = 0; y < TILE_SIZE; y += 8) rect(ctx, x0, y0, 0, y, TILE_SIZE, 1, '#d9c7a0')
      for (let y = 0; y < TILE_SIZE; y += 16) {
        for (let x = 0; x < TILE_SIZE; x += 8) rect(ctx, x0, y0, x + 7, y, 1, 8, '#d9c7a0')
      }
      for (let y = 8; y < TILE_SIZE; y += 16) {
        for (let x = 0; x < TILE_SIZE; x += 8) rect(ctx, x0, y0, x + 3, y, 1, 8, '#d9c7a0')
      }
      break
    case TILE.WATER:
      paintNoise(ctx, x0, y0, 0x3d7ad6, 18, 22)
      break
    case TILE.COAL_ORE: paintOre(ctx, x0, y0, '#2f2f2f', 30); break
    case TILE.IRON_ORE: paintOre(ctx, x0, y0, '#d8a06a', 31); break
    case TILE.GOLD_ORE: paintOre(ctx, x0, y0, '#f2d24b', 32); break
    case TILE.DIAMOND_ORE: paintOre(ctx, x0, y0, '#4ee3d8', 33); break
    case TILE.BEDROCK: paintBedrock(ctx, x0, y0); break
    case TILE.STICK: paintStick(ctx, x0, y0); break
    case TILE.COAL: paintCoal(ctx, x0, y0); break
    case TILE.IRON_INGOT: paintIngot(ctx, x0, y0, '#cfcfcf', '#f2f2f2', '#9a9a9a'); break
    case TILE.GOLD_INGOT: paintIngot(ctx, x0, y0, '#f5d54a', '#fff29a', '#c8a520'); break
    case TILE.DIAMOND: paintDiamond(ctx, x0, y0); break
    case TILE.PICK_WOOD: drawPickaxe(ctx, x0, y0, TOOL_HEAD.wood); break
    case TILE.PICK_STONE: drawPickaxe(ctx, x0, y0, TOOL_HEAD.stone); break
    case TILE.PICK_IRON: drawPickaxe(ctx, x0, y0, TOOL_HEAD.iron); break
    case TILE.PICK_DIAMOND: drawPickaxe(ctx, x0, y0, TOOL_HEAD.diamond); break
    case TILE.AXE_WOOD: drawAxe(ctx, x0, y0, TOOL_HEAD.wood); break
    case TILE.AXE_STONE: drawAxe(ctx, x0, y0, TOOL_HEAD.stone); break
    case TILE.AXE_IRON: drawAxe(ctx, x0, y0, TOOL_HEAD.iron); break
    case TILE.AXE_DIAMOND: drawAxe(ctx, x0, y0, TOOL_HEAD.diamond); break
    case TILE.SHOVEL_WOOD: drawShovel(ctx, x0, y0, TOOL_HEAD.wood); break
    case TILE.SHOVEL_STONE: drawShovel(ctx, x0, y0, TOOL_HEAD.stone); break
    case TILE.SHOVEL_IRON: drawShovel(ctx, x0, y0, TOOL_HEAD.iron); break
    case TILE.SHOVEL_DIAMOND: drawShovel(ctx, x0, y0, TOOL_HEAD.diamond); break
    default: break
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

export function tileUV(index) {
  const col = index % ATLAS_COLS
  const row = Math.floor(index / ATLAS_COLS)
  const iw = 1 / ATLAS_COLS
  const ih = 1 / ATLAS_ROWS
  const inset = 0.0015
  return {
    u0: col * iw + inset,
    u1: (col + 1) * iw - inset,
    v1: 1 - row * ih - inset,
    v0: 1 - (row + 1) * ih + inset,
  }
}

export function tileDataURL(index, scale = 3) {
  const src = getAtlasCanvas()
  const col = index % ATLAS_COLS
  const row = Math.floor(index / ATLAS_COLS)
  const out = document.createElement('canvas')
  out.width = TILE_SIZE * scale
  out.height = TILE_SIZE * scale
  const ctx = out.getContext('2d')
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(src, col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE, 0, 0, out.width, out.height)
  return out.toDataURL()
}

// 블록의 면별 타일 (메시 생성용)
export const BLOCKS = {
  1: { tiles: { top: TILE.GRASS_TOP, side: TILE.GRASS_SIDE, bottom: TILE.DIRT } },
  2: { tiles: { top: TILE.DIRT, side: TILE.DIRT, bottom: TILE.DIRT } },
  3: { tiles: { top: TILE.STONE, side: TILE.STONE, bottom: TILE.STONE } },
  4: { tiles: { top: TILE.SAND, side: TILE.SAND, bottom: TILE.SAND } },
  5: { tiles: { top: TILE.LOG_TOP, side: TILE.LOG_SIDE, bottom: TILE.LOG_TOP } },
  6: { tiles: { top: TILE.LEAVES, side: TILE.LEAVES, bottom: TILE.LEAVES } },
  7: { tiles: { top: TILE.PLANK, side: TILE.PLANK, bottom: TILE.PLANK } },
  8: { tiles: { top: TILE.COBBLE, side: TILE.COBBLE, bottom: TILE.COBBLE } },
  9: { tiles: { top: TILE.BRICK, side: TILE.BRICK, bottom: TILE.BRICK } },
  10: { tiles: { top: TILE.COAL_ORE, side: TILE.COAL_ORE, bottom: TILE.COAL_ORE } },
  11: { tiles: { top: TILE.IRON_ORE, side: TILE.IRON_ORE, bottom: TILE.IRON_ORE } },
  12: { tiles: { top: TILE.GOLD_ORE, side: TILE.GOLD_ORE, bottom: TILE.GOLD_ORE } },
  13: { tiles: { top: TILE.DIAMOND_ORE, side: TILE.DIAMOND_ORE, bottom: TILE.DIAMOND_ORE } },
  14: { tiles: { top: TILE.BEDROCK, side: TILE.BEDROCK, bottom: TILE.BEDROCK } },
}
