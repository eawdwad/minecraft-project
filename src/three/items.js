import { TILE } from './textures'

// 아이템/블록 ID (블록은 월드의 블록 ID와 동일한 번호를 쓴다)
export const ITEM = {
  // 블록 (배치 가능)
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  SAND: 4,
  LOG: 5,
  LEAVES: 6,
  PLANK: 7,
  COBBLE: 8,
  BRICK: 9,
  COAL_ORE: 10,
  IRON_ORE: 11,
  GOLD_ORE: 12,
  DIAMOND_ORE: 13,
  BEDROCK: 14,
  FURNACE: 15,
  // 재료
  STICK: 20,
  COAL: 21,
  IRON_INGOT: 22,
  GOLD_INGOT: 23,
  DIAMOND: 24,
  LEATHER: 60,
  // 음식
  BEEF_RAW: 61,
  BEEF_COOKED: 62,
  PORK_RAW: 63,
  PORK_COOKED: 64,
  // 도구 (곡괭이)
  WOOD_PICKAXE: 40,
  STONE_PICKAXE: 41,
  IRON_PICKAXE: 42,
  DIAMOND_PICKAXE: 43,
  // 도구 (도끼)
  WOOD_AXE: 44,
  STONE_AXE: 45,
  IRON_AXE: 46,
  DIAMOND_AXE: 47,
  // 도구 (삽)
  WOOD_SHOVEL: 48,
  STONE_SHOVEL: 49,
  IRON_SHOVEL: 50,
  DIAMOND_SHOVEL: 51,
  // 갑옷 (가죽)
  LEATHER_HELMET: 70,
  LEATHER_CHEST: 71,
  LEATHER_LEGS: 72,
  LEATHER_BOOTS: 73,
  // 갑옷 (철)
  IRON_HELMET: 74,
  IRON_CHEST: 75,
  IRON_LEGS: 76,
  IRON_BOOTS: 77,
  // 갑옷 (다이아몬드)
  DIAMOND_HELMET: 78,
  DIAMOND_CHEST: 79,
  DIAMOND_LEGS: 80,
  DIAMOND_BOOTS: 81,
}

const block = (name, tile) => ({ name, tile, block: true, stack: 64 })
const mat = (name, tile) => ({ name, tile, stack: 64 })
const tool = (name, tile, kind, tier) => ({ name, tile, kind, tier, stack: 1 })
const food = (name, tile, hunger) => ({ name, tile, food: { hunger }, stack: 64 })
const armor = (name, tile, part, points) => ({ name, tile, armor: part, armorPoints: points, stack: 1 })

export const ARMOR_PARTS = ['helmet', 'chest', 'legs', 'boots']
export const ARMOR_PART_NAME = { helmet: '투구', chest: '흉갑', legs: '레깅스', boots: '부츠' }

export const ITEMS = {
  [ITEM.GRASS]: block('잔디', TILE.GRASS_SIDE),
  [ITEM.DIRT]: block('흙', TILE.DIRT),
  [ITEM.STONE]: block('돌', TILE.STONE),
  [ITEM.SAND]: block('모래', TILE.SAND),
  [ITEM.LOG]: block('원목', TILE.LOG_SIDE),
  [ITEM.LEAVES]: block('나뭇잎', TILE.LEAVES),
  [ITEM.PLANK]: block('나무판자', TILE.PLANK),
  [ITEM.COBBLE]: block('조약돌', TILE.COBBLE),
  [ITEM.BRICK]: block('벽돌', TILE.BRICK),
  [ITEM.COAL_ORE]: block('석탄 원석', TILE.COAL_ORE),
  [ITEM.IRON_ORE]: block('철 원석', TILE.IRON_ORE),
  [ITEM.GOLD_ORE]: block('금 원석', TILE.GOLD_ORE),
  [ITEM.DIAMOND_ORE]: block('다이아몬드 원석', TILE.DIAMOND_ORE),
  [ITEM.BEDROCK]: block('기반암', TILE.BEDROCK),
  [ITEM.FURNACE]: block('화로', TILE.FURNACE_FRONT),
  [ITEM.STICK]: mat('막대기', TILE.STICK),
  [ITEM.COAL]: mat('석탄', TILE.COAL),
  [ITEM.IRON_INGOT]: mat('철 주괴', TILE.IRON_INGOT),
  [ITEM.GOLD_INGOT]: mat('금 주괴', TILE.GOLD_INGOT),
  [ITEM.DIAMOND]: mat('다이아몬드', TILE.DIAMOND),
  [ITEM.LEATHER]: mat('가죽', TILE.LEATHER),
  [ITEM.BEEF_RAW]: food('익히지 않은 소고기', TILE.BEEF_RAW, 3),
  [ITEM.BEEF_COOKED]: food('스테이크', TILE.BEEF_COOKED, 8),
  [ITEM.PORK_RAW]: food('익히지 않은 돼지고기', TILE.PORK_RAW, 3),
  [ITEM.PORK_COOKED]: food('구운 돼지고기', TILE.PORK_COOKED, 8),
  [ITEM.WOOD_PICKAXE]: tool('나무 곡괭이', TILE.PICK_WOOD, 'pickaxe', 1),
  [ITEM.STONE_PICKAXE]: tool('돌 곡괭이', TILE.PICK_STONE, 'pickaxe', 2),
  [ITEM.IRON_PICKAXE]: tool('철 곡괭이', TILE.PICK_IRON, 'pickaxe', 3),
  [ITEM.DIAMOND_PICKAXE]: tool('다이아몬드 곡괭이', TILE.PICK_DIAMOND, 'pickaxe', 4),
  [ITEM.WOOD_AXE]: tool('나무 도끼', TILE.AXE_WOOD, 'axe', 1),
  [ITEM.STONE_AXE]: tool('돌 도끼', TILE.AXE_STONE, 'axe', 2),
  [ITEM.IRON_AXE]: tool('철 도끼', TILE.AXE_IRON, 'axe', 3),
  [ITEM.DIAMOND_AXE]: tool('다이아몬드 도끼', TILE.AXE_DIAMOND, 'axe', 4),
  [ITEM.WOOD_SHOVEL]: tool('나무 삽', TILE.SHOVEL_WOOD, 'shovel', 1),
  [ITEM.STONE_SHOVEL]: tool('돌 삽', TILE.SHOVEL_STONE, 'shovel', 2),
  [ITEM.IRON_SHOVEL]: tool('철 삽', TILE.SHOVEL_IRON, 'shovel', 3),
  [ITEM.DIAMOND_SHOVEL]: tool('다이아몬드 삽', TILE.SHOVEL_DIAMOND, 'shovel', 4),
  [ITEM.LEATHER_HELMET]: armor('가죽 투구', TILE.HELMET_LEATHER, 'helmet', 1),
  [ITEM.LEATHER_CHEST]: armor('가죽 흉갑', TILE.CHEST_LEATHER, 'chest', 3),
  [ITEM.LEATHER_LEGS]: armor('가죽 레깅스', TILE.LEGS_LEATHER, 'legs', 2),
  [ITEM.LEATHER_BOOTS]: armor('가죽 부츠', TILE.BOOTS_LEATHER, 'boots', 1),
  [ITEM.IRON_HELMET]: armor('철 투구', TILE.HELMET_IRON, 'helmet', 2),
  [ITEM.IRON_CHEST]: armor('철 흉갑', TILE.CHEST_IRON, 'chest', 6),
  [ITEM.IRON_LEGS]: armor('철 레깅스', TILE.LEGS_IRON, 'legs', 5),
  [ITEM.IRON_BOOTS]: armor('철 부츠', TILE.BOOTS_IRON, 'boots', 2),
  [ITEM.DIAMOND_HELMET]: armor('다이아몬드 투구', TILE.HELMET_DIAMOND, 'helmet', 3),
  [ITEM.DIAMOND_CHEST]: armor('다이아몬드 흉갑', TILE.CHEST_DIAMOND, 'chest', 8),
  [ITEM.DIAMOND_LEGS]: armor('다이아몬드 레깅스', TILE.LEGS_DIAMOND, 'legs', 6),
  [ITEM.DIAMOND_BOOTS]: armor('다이아몬드 부츠', TILE.BOOTS_DIAMOND, 'boots', 3),
}

// 도구 티어 이름 (0 = 맨손)
export const TIER_NAME = ['맨손', '나무', '돌', '철', '다이아몬드']

// 티어별 채굴 속도 배율 (올바른 도구 + 충분한 티어일 때만 적용)
export const TIER_SPEED = { 1: 2, 2: 4, 3: 6, 4: 8 }

// 블록별 성질:
//  hardness : 파괴에 필요한 누적 시간 (초, 맨손 속도 기준)
//  tool     : 효율이 나는 도구 종류 (null = 아무 도구나)
//  minTier  : 이 블록을 캐기 위해 필요한 최소 도구 티어 (99 = 불가)
//  drops    : 파괴 시 떨어지는 아이템 ID (0 = 없음)
export const BLOCK_PROPS = {
  [ITEM.GRASS]: { hardness: 0.6, tool: 'shovel', minTier: 0, drops: ITEM.DIRT },
  [ITEM.DIRT]: { hardness: 0.5, tool: 'shovel', minTier: 0, drops: ITEM.DIRT },
  [ITEM.SAND]: { hardness: 0.5, tool: 'shovel', minTier: 0, drops: ITEM.SAND },
  [ITEM.LOG]: { hardness: 2.0, tool: 'axe', minTier: 0, drops: ITEM.LOG },
  [ITEM.LEAVES]: { hardness: 0.2, tool: null, minTier: 0, drops: ITEM.LEAVES },
  [ITEM.PLANK]: { hardness: 2.0, tool: 'axe', minTier: 0, drops: ITEM.PLANK },
  [ITEM.STONE]: { hardness: 1.5, tool: 'pickaxe', minTier: 1, drops: ITEM.COBBLE },
  [ITEM.COBBLE]: { hardness: 2.0, tool: 'pickaxe', minTier: 1, drops: ITEM.COBBLE },
  [ITEM.BRICK]: { hardness: 2.0, tool: 'pickaxe', minTier: 1, drops: ITEM.BRICK },
  [ITEM.FURNACE]: { hardness: 3.0, tool: 'pickaxe', minTier: 1, drops: ITEM.FURNACE },
  [ITEM.COAL_ORE]: { hardness: 3.0, tool: 'pickaxe', minTier: 1, drops: ITEM.COAL },
  [ITEM.IRON_ORE]: { hardness: 3.0, tool: 'pickaxe', minTier: 2, drops: ITEM.IRON_INGOT },
  [ITEM.GOLD_ORE]: { hardness: 3.0, tool: 'pickaxe', minTier: 3, drops: ITEM.GOLD_INGOT },
  [ITEM.DIAMOND_ORE]: { hardness: 3.0, tool: 'pickaxe', minTier: 3, drops: ITEM.DIAMOND },
  [ITEM.BEDROCK]: { hardness: Infinity, tool: 'pickaxe', minTier: 99, drops: 0 },
}

export function canHarvest(blockId, held) {
  const props = BLOCK_PROPS[blockId]
  if (!props) return false
  if (props.minTier >= 99) return false
  if (props.minTier <= 0) return true
  const item = held ? ITEMS[held.id] : null
  return !!(item && item.kind === props.tool && (item.tier || 0) >= props.minTier)
}

export function miningSpeed(blockId, held) {
  const props = BLOCK_PROPS[blockId]
  if (!props || !props.tool) return 1
  const item = held ? ITEMS[held.id] : null
  if (!item || item.kind !== props.tool) return 1
  if ((item.tier || 0) < props.minTier) return 1
  return TIER_SPEED[item.tier] || 1
}

export function requiredToolText(blockId) {
  const props = BLOCK_PROPS[blockId]
  if (!props || !props.tool) return ''
  const kindName = { pickaxe: '곡괭이', axe: '도끼', shovel: '삽' }[props.tool] || '도구'
  return `${TIER_NAME[props.minTier]} ${kindName} 이상 필요`
}

// ------------------------------------------------------------- 제작 레시피

export const RECIPES = [
  { id: 'planks', output: { id: ITEM.PLANK, count: 4 }, cost: [{ id: ITEM.LOG, count: 1 }] },
  { id: 'sticks', output: { id: ITEM.STICK, count: 4 }, cost: [{ id: ITEM.PLANK, count: 2 }] },
  { id: 'furnace', output: { id: ITEM.FURNACE, count: 1 }, cost: [{ id: ITEM.COBBLE, count: 8 }] },
]

const TOOL_MATS = [
  [ITEM.PLANK, '나무'],
  [ITEM.COBBLE, '돌'],
  [ITEM.IRON_INGOT, '철'],
  [ITEM.DIAMOND, '다이아몬드'],
]

const TOOL_KINDS = [
  { head: 3, ids: [ITEM.WOOD_PICKAXE, ITEM.STONE_PICKAXE, ITEM.IRON_PICKAXE, ITEM.DIAMOND_PICKAXE] },
  { head: 3, ids: [ITEM.WOOD_AXE, ITEM.STONE_AXE, ITEM.IRON_AXE, ITEM.DIAMOND_AXE] },
  { head: 1, ids: [ITEM.WOOD_SHOVEL, ITEM.STONE_SHOVEL, ITEM.IRON_SHOVEL, ITEM.DIAMOND_SHOVEL] },
]

for (const kind of TOOL_KINDS) {
  TOOL_MATS.forEach(([matId], i) => {
    const outId = kind.ids[i]
    RECIPES.push({
      id: `tool_${outId}`,
      output: { id: outId, count: 1 },
      cost: [
        { id: matId, count: kind.head },
        { id: ITEM.STICK, count: 2 },
      ],
    })
  })
}

// 갑옷 레시피 (재료: 가죽 / 철 / 다이아몬드)
const ARMOR_MATS = [
  [ITEM.LEATHER, [ITEM.LEATHER_HELMET, ITEM.LEATHER_CHEST, ITEM.LEATHER_LEGS, ITEM.LEATHER_BOOTS]],
  [ITEM.IRON_INGOT, [ITEM.IRON_HELMET, ITEM.IRON_CHEST, ITEM.IRON_LEGS, ITEM.IRON_BOOTS]],
  [ITEM.DIAMOND, [ITEM.DIAMOND_HELMET, ITEM.DIAMOND_CHEST, ITEM.DIAMOND_LEGS, ITEM.DIAMOND_BOOTS]],
]
const ARMOR_COST = { helmet: 5, chest: 8, legs: 7, boots: 4 }

ARMOR_MATS.forEach(([matId, ids]) => {
  ARMOR_PARTS.forEach((part, i) => {
    const outId = ids[i]
    RECIPES.push({
      id: `armor_${outId}`,
      output: { id: outId, count: 1 },
      cost: [{ id: matId, count: ARMOR_COST[part] }],
    })
  })
})

// 화로 조리 레시피 (원재료 + 연료 -> 구운 음식)
export const COOK_RECIPES = [
  { id: 'cook_beef', input: ITEM.BEEF_RAW, output: ITEM.BEEF_COOKED, fuel: ITEM.COAL, fuelCount: 1 },
  { id: 'cook_pork', input: ITEM.PORK_RAW, output: ITEM.PORK_COOKED, fuel: ITEM.COAL, fuelCount: 1 },
]
