import * as THREE from 'three'
import { ITEM } from './items'

// 동물 정의: 체력, 이동 속도, 색, 드롭 아이템
export const MOB_TYPES = {
  cow: {
    name: '소',
    health: 6,
    speed: 1.1,
    colors: { body: 0xd9c7a0, head: 0xd9c7a0, leg: 0x8a7a5a, accent: 0xe8e0c0 },
    size: { w: 1.0, h: 0.85, d: 1.5 },
    drops: [
      { id: ITEM.BEEF_RAW, min: 1, max: 2 },
      { id: ITEM.LEATHER, min: 1, max: 1 },
    ],
  },
  pig: {
    name: '돼지',
    health: 6,
    speed: 1.35,
    colors: { body: 0xe0898f, head: 0xe0898f, leg: 0xb35e66, accent: 0xc46b72 },
    size: { w: 0.95, h: 0.8, d: 1.4 },
    drops: [{ id: ITEM.PORK_RAW, min: 1, max: 2 }],
  },
}

const geoCache = new Map()
function box(w, h, d) {
  const key = `${w}|${h}|${d}`
  let g = geoCache.get(key)
  if (!g) {
    g = new THREE.BoxGeometry(w, h, d)
    geoCache.set(key, g)
  }
  return g
}

const matCache = new Map()
function mat(color) {
  let m = matCache.get(color)
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color })
    matCache.set(color, m)
  }
  return m
}

// 동물 하나의 메시 그룹을 만든다. 머리는 -Z 방향을 향한다.
export function createMobObject(type) {
  const def = MOB_TYPES[type]
  const { w, h, d } = def.size
  const { body, head, leg, accent } = def.colors
  const group = new THREE.Group()

  const bodyMesh = new THREE.Mesh(box(w, h, d), mat(body))
  bodyMesh.position.y = h / 2 + 0.5
  group.add(bodyMesh)

  const headMesh = new THREE.Mesh(box(w * 0.72, w * 0.72, w * 0.72), mat(head))
  headMesh.position.set(0, h + 0.45, -d / 2 - w * 0.28)
  group.add(headMesh)

  const legW = 0.2
  const legH = 0.55
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const legMesh = new THREE.Mesh(box(legW, legH, legW), mat(leg))
      legMesh.position.set(sx * (w / 2 - legW), legH / 2, sz * (d / 2 - legW))
      group.add(legMesh)
    }
  }

  if (type === 'pig') {
    const snout = new THREE.Mesh(box(w * 0.42, w * 0.3, w * 0.14), mat(accent))
    snout.position.set(0, h + 0.4, -d / 2 - w * 0.62)
    group.add(snout)
  } else {
    for (const sx of [-1, 1]) {
      const horn = new THREE.Mesh(box(0.1, 0.1, 0.24), mat(accent))
      horn.position.set(sx * w * 0.28, h + 0.82, -d / 2 - w * 0.16)
      group.add(horn)
    }
  }

  group.userData.mobRef = null
  return group
}
