import * as THREE from 'three'
import { createAtlasTexture } from './textures'
import {
  ITEM,
  ITEMS,
  ARMOR_PARTS,
  BLOCK_PROPS,
  COOK_RECIPES,
  canHarvest,
  miningSpeed,
  requiredToolText,
  RECIPES,
} from './items'
import { MOB_TYPES, createMobObject } from './mobs'
import {
  World,
  generateTerrain,
  buildChunkGeometry,
  WORLD_X,
  WORLD_Y,
  WORLD_Z,
  CHUNK_SIZE,
  CHUNKS_X,
  CHUNKS_Z,
} from './world'

const HALF_W = 0.3
const HEIGHT = 1.8
const EYE = 1.62
const EPS = 0.001
const GRAVITY = 28
const JUMP_SPEED = 8.6
const WALK_SPEED = 4.6
const SPRINT_SPEED = 7.0
const FLY_SPEED = 10
const REACH = 6
const MAX_PITCH = Math.PI / 2 - 0.02
const HOTBAR_SIZE = 9
const INVENTORY_SIZE = 36

const MAX_HEALTH = 20
const MAX_HUNGER = 20
const MOB_MAX = 12
const MOB_SPAWN_INTERVAL = 10
const ATTACK_COOLDOWN = 0.35

export default class MinecraftEngine {
  constructor(container, options = {}) {
    this.container = container
    this.onState = options.onState || (() => {})
    this.onFps = options.onFps || (() => {})
    this.onInventory = options.onInventory || (() => {})
    this.onToast = options.onToast || (() => {})
    this.onMining = options.onMining || (() => {})
    this.onVitals = options.onVitals || (() => {})

    // active: 게임 진행 중 여부. locked: 포인터 락 사용 여부.
    this.active = false
    this.locked = false
    this.lockBlocked = false // 이 환경에서 포인터 락이 아예 불가능한 경우
    this.lockBeforeUI = false
    this.inventoryOpen = false
    this.furnaceOpen = false
    this.dragging = false
    this.dragButton = 0
    this.dragMoved = 0
    this.lastX = 0
    this.lastY = 0

    this.keys = new Set()
    this.fly = false
    this.onGround = false
    this.hit = null

    // 생명력 / 허기 / 갑옷
    this.health = MAX_HEALTH
    this.hunger = MAX_HUNGER
    this.armor = { helmet: null, chest: null, legs: null, boots: null }
    this.regenTimer = 0
    this.starveTimer = 0
    this.lastVitals = { health: -1, hunger: -1, armor: -1 }

    // 낙하 데미지
    this.maxFallY = 0
    this.wasAirborne = false

    // 채굴 상태
    this.miningHeld = false
    this.miningTarget = null
    this.miningProgress = 0
    this.attackCooldown = 0

    // 인벤토리 (앞 9칸 = 핫바)
    this.slots = new Array(INVENTORY_SIZE).fill(null)
    this.hotbarIndex = 0

    // 동물
    this.mobs = []
    this.mobTimer = MOB_SPAWN_INTERVAL

    // 토스트
    this.toastSeq = 0
    this.toastCooldown = 0

    // 월드 + 장면
    this.world = new World()
    generateTerrain(this.world)

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x9fd4ff)
    this.scene.fog = new THREE.Fog(0x9fd4ff, 45, 110)

    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 500)

    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(container.clientWidth || 800, container.clientHeight || 500)
    this.renderer.domElement.classList.add('mc-canvas')
    container.appendChild(this.renderer.domElement)

    this.scene.add(new THREE.AmbientLight(0xffffff, 1.0))

    this.material = new THREE.MeshLambertMaterial({
      map: createAtlasTexture(),
      vertexColors: true,
    })

    this.chunkGroup = new THREE.Group()
    this.scene.add(this.chunkGroup)
    this.chunks = new Map()
    this.buildAllChunks()

    // 동물 그룹
    this.mobGroup = new THREE.Group()
    this.scene.add(this.mobGroup)

    // 바라보는 블록 하이라이트
    this.highlight = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)),
      new THREE.LineBasicMaterial({ color: 0x0a0a0a, transparent: true, opacity: 0.5 }),
    )
    this.highlight.visible = false
    this.scene.add(this.highlight)

    this.raycaster = new THREE.Raycaster()
    this.raycaster.far = REACH + 1
    this.ndc = new THREE.Vector2(0, 0)

    // 플레이어 초기 위치
    const spawnY = this.world.surfaceHeight(Math.floor(WORLD_X / 2), Math.floor(WORLD_Z / 2))
    this.pos = new THREE.Vector3(WORLD_X / 2 + 0.5, spawnY + EPS, WORLD_Z / 2 + 0.5)
    this.vel = new THREE.Vector3()
    this.yaw = 0
    this.pitch = 0
    this.maxFallY = this.pos.y

    // 초기 동물 배치
    for (let i = 0; i < 8; i += 1) this.spawnMob(true)

    this.clockLast = performance.now()
    this.fpsAccumulator = 0
    this.fpsFrames = 0
    this.running = true

    this.bindEvents()
    this.applyCamera()
    this.emitInventory()
    this.emitVitals(true)
    this.loop()
  }

  // ------------------------------------------------------------- 이벤트 바인딩

  bindEvents() {
    this.handleKeyDown = (e) => {
      this.keys.add(e.code)
      if (e.code === 'KeyF' && !this.isUiOpen()) this.fly = !this.fly
      if (e.code === 'KeyE' && this.active && !this.furnaceOpen) {
        e.preventDefault()
        this.toggleInventory()
      }
      // Esc: 인벤토리/화로 닫기 → 포인터 락 없는 환경에선 일시정지
      if (e.code === 'Escape') {
        if (this.inventoryOpen) {
          this.toggleInventory()
        } else if (this.furnaceOpen) {
          this.closeFurnace()
        } else if (this.active && !this.locked) {
          this.active = false
          this.miningHeld = false
          this.notify()
        }
      }
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault()
      }
    }
    this.handleKeyUp = (e) => this.keys.delete(e.code)
    this.handleBlur = () => {
      this.keys.clear()
      this.miningHeld = false
      this.miningProgress = 0
    }

    this.handleMouseMove = (e) => {
      if (this.locked) {
        this.yaw -= e.movementX * 0.0022
        this.pitch -= e.movementY * 0.0022
        this.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, this.pitch))
        return
      }
      // 대체 모드: 드래그로 시점 회전
      if (!this.active || this.isUiOpen() || !this.dragging) return
      const dx = e.clientX - this.lastX
      const dy = e.clientY - this.lastY
      this.lastX = e.clientX
      this.lastY = e.clientY
      this.dragMoved += Math.abs(dx) + Math.abs(dy)
      this.yaw -= dx * 0.0045
      this.pitch -= dy * 0.0045
      this.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, this.pitch))
    }

    this.handleMouseDown = (e) => {
      if (!this.active || this.isUiOpen()) return
      if (this.locked) {
        this.dragButton = e.button
        if (e.button === 0) {
          this.miningHeld = true
          this.miningProgress = 0
          this.miningTarget = null
        } else if (e.button === 2) {
          this.useHeld()
        }
        return
      }
      // 대체 모드: 캔버스 위에서만 시작 (UI 클릭은 무시)
      if (!this.renderer.domElement.contains(e.target)) return
      this.dragging = true
      this.dragButton = e.button
      this.dragMoved = 0
      this.lastX = e.clientX
      this.lastY = e.clientY
      if (e.button === 0) {
        this.miningHeld = true
        this.miningProgress = 0
        this.miningTarget = null
      }
      e.preventDefault()
    }

    this.handleMouseUp = (e) => {
      const wasDragging = this.dragging
      const wasClick = this.dragMoved < 6
      const button = wasDragging ? this.dragButton : (e && typeof e.button === 'number' ? e.button : this.dragButton)
      this.dragging = false
      // 버튼 종류와 무관하게 좌클릭 채굴은 종료 (놓침 방지)
      this.miningHeld = false
      this.miningProgress = 0
      this.miningTarget = null
      if (!this.active || this.locked || this.isUiOpen()) return
      if (!wasDragging) return
      // 대체 모드: 거의 안 움직인 우클릭만 사용/설치
      if (wasClick && button === 2) this.useHeld()
    }

    // 창 밖으로 나가면 채굴/드래그 상태를 확실히 해제
    this.handleMouseLeave = () => {
      this.dragging = false
      this.miningHeld = false
      this.miningProgress = 0
      this.miningTarget = null
    }

    this.handleContextMenu = (e) => e.preventDefault()
    this.handlePointerLockChange = () => {
      const locked = document.pointerLockElement === this.renderer.domElement
      const wasLocked = this.locked
      this.locked = locked
      if (locked) {
        this.hasLocked = true
        this.active = true
      } else if (wasLocked && !this.lockBlocked && !this.isUiOpen()) {
        // 실제로 잠금 상태였다가 풀린 경우에만 일시정지 (Esc 등)
        this.active = false
        this.miningHeld = false
      }
      this.notify()
    }
    this.handlePointerLockError = () => {
      this.lockBlocked = true
      this.notify()
    }
    this.handleResize = () => this.resize()

    window.addEventListener('keydown', this.handleKeyDown)
    window.addEventListener('keyup', this.handleKeyUp)
    window.addEventListener('blur', this.handleBlur)
    document.addEventListener('mousemove', this.handleMouseMove)
    document.addEventListener('mousedown', this.handleMouseDown)
    document.addEventListener('mouseup', this.handleMouseUp)
    document.addEventListener('mouseleave', this.handleMouseLeave)
    document.addEventListener('contextmenu', this.handleContextMenu)
    document.addEventListener('pointerlockchange', this.handlePointerLockChange)
    document.addEventListener('pointerlockerror', this.handlePointerLockError)
    window.addEventListener('resize', this.handleResize)
  }

  // 게임 시작: 포인터 락을 시도하고, 안 되면 드래그 시점 모드로 진행한다.
  start() {
    this.active = true
    this.notify()
    this.requestLock()
  }

  requestLock() {
    if (this.lockBlocked) return
    const el = this.renderer.domElement
    try {
      const result = el.requestPointerLock?.()
      if (result && typeof result.catch === 'function') {
        result.catch((err) => {
          if (this.isLockBlockedError(err)) {
            this.lockBlocked = true
            this.notify()
          }
        })
      }
    } catch (err) {
      if (this.isLockBlockedError(err)) {
        this.lockBlocked = true
        this.notify()
      }
    }
  }

  isLockBlockedError(err) {
    const message = String((err && err.message) || err || '')
    return message.includes('root document') || message.includes('not valid for pointer lock')
  }

  notify() {
    this.onState({
      running: this.active,
      locked: this.locked,
      fallback: this.active && !this.locked,
      lockBlocked: this.lockBlocked,
      inventoryOpen: this.inventoryOpen,
      furnaceOpen: this.furnaceOpen,
    })
  }

  isUiOpen() {
    return this.inventoryOpen || this.furnaceOpen
  }

  enterUi() {
    this.lockBeforeUI = this.locked
    if (this.locked) document.exitPointerLock()
    this.miningHeld = false
    this.miningProgress = 0
    this.miningTarget = null
    this.keys.clear()
  }

  exitUi() {
    if (this.lockBeforeUI && !this.lockBlocked && this.active) this.requestLock()
    this.lockBeforeUI = false
  }

  toggleInventory() {
    if (!this.active) return
    if (this.inventoryOpen) {
      this.inventoryOpen = false
      this.exitUi()
    } else {
      this.inventoryOpen = true
      this.furnaceOpen = false
      this.enterUi()
    }
    this.notify()
  }

  openFurnace() {
    if (!this.active || this.furnaceOpen) return
    this.inventoryOpen = false
    this.furnaceOpen = true
    this.enterUi()
    this.notify()
  }

  closeFurnace() {
    if (!this.furnaceOpen) return
    this.furnaceOpen = false
    this.exitUi()
    this.notify()
  }

  resize() {
    const w = this.container.clientWidth || 800
    const h = this.container.clientHeight || 500
    this.renderer.setSize(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  destroy() {
    this.running = false
    if (document.pointerLockElement === this.renderer.domElement) document.exitPointerLock()
    window.removeEventListener('keydown', this.handleKeyDown)
    window.removeEventListener('keyup', this.handleKeyUp)
    window.removeEventListener('blur', this.handleBlur)
    document.removeEventListener('mousemove', this.handleMouseMove)
    document.removeEventListener('mousedown', this.handleMouseDown)
    document.removeEventListener('mouseup', this.handleMouseUp)
    document.removeEventListener('mouseleave', this.handleMouseLeave)
    document.removeEventListener('contextmenu', this.handleContextMenu)
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange)
    document.removeEventListener('pointerlockerror', this.handlePointerLockError)
    window.removeEventListener('resize', this.handleResize)

    for (const mesh of this.chunks.values()) mesh.geometry.dispose()
    this.material.map?.dispose()
    this.material.dispose()
    this.highlight.geometry.dispose()
    this.highlight.material.dispose()
    this.renderer.dispose()
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement)
    }
  }

  // ------------------------------------------------------------------ 인벤토리

  getSelectedItem() {
    return this.slots[this.hotbarIndex] || null
  }

  countItem(id) {
    let total = 0
    for (const slot of this.slots) {
      if (slot && slot.id === id) total += slot.count
    }
    return total
  }

  addItem(id, count) {
    const def = ITEMS[id]
    if (!def || !count) return 0
    const max = def.stack || 64
    let remaining = count
    for (let i = 0; i < this.slots.length && remaining > 0; i += 1) {
      const slot = this.slots[i]
      if (slot && slot.id === id && slot.count < max) {
        const add = Math.min(max - slot.count, remaining)
        slot.count += add
        remaining -= add
      }
    }
    for (let i = 0; i < this.slots.length && remaining > 0; i += 1) {
      if (!this.slots[i]) {
        const add = Math.min(max, remaining)
        this.slots[i] = { id, count: add }
        remaining -= add
      }
    }
    this.emitInventory()
    return count - remaining
  }

  removeItems(id, count) {
    let remaining = count
    for (let i = 0; i < this.slots.length && remaining > 0; i += 1) {
      const slot = this.slots[i]
      if (!slot || slot.id !== id) continue
      const take = Math.min(slot.count, remaining)
      slot.count -= take
      remaining -= take
      if (slot.count <= 0) this.slots[i] = null
    }
    this.emitInventory()
    return count - remaining
  }

  setHotbarIndex(index) {
    const n = Math.max(0, Math.min(HOTBAR_SIZE - 1, index))
    this.hotbarIndex = n
    this.emitInventory()
  }

  cycleHotbar(delta) {
    this.setHotbarIndex((this.hotbarIndex + delta + HOTBAR_SIZE) % HOTBAR_SIZE)
  }

  // 메인 인벤토리 칸을 현재 핫바 칸과 맞바꾼다 (도구를 핫바로 옮길 때 사용)
  swapWithHotbar(index) {
    if (index < HOTBAR_SIZE || index >= this.slots.length) return
    const tmp = this.slots[index]
    this.slots[index] = this.slots[this.hotbarIndex]
    this.slots[this.hotbarIndex] = tmp
    this.emitInventory()
  }

  // 인벤토리 칸 클릭: 갑옷이면 장착, 핫바면 선택, 아니면 핫바와 교환
  clickSlot(index) {
    const slot = this.slots[index]
    const def = slot ? ITEMS[slot.id] : null
    if (def && def.armor) {
      this.equipArmor(index)
      return
    }
    if (index < HOTBAR_SIZE) this.setHotbarIndex(index)
    else this.swapWithHotbar(index)
  }

  // ------------------------------------------------------------------ 갑옷

  armorPoints() {
    let points = 0
    for (const part of ARMOR_PARTS) {
      const a = this.armor[part]
      if (a) points += ITEMS[a.id]?.armorPoints || 0
    }
    return points
  }

  equipArmor(index) {
    const slot = this.slots[index]
    if (!slot) return
    const def = ITEMS[slot.id]
    if (!def || !def.armor) return
    const part = def.armor
    const prev = this.armor[part]
    this.armor[part] = { id: slot.id, count: 1 }
    this.slots[index] = prev ? { id: prev.id, count: 1 } : null
    this.showToast(`🛡️ ${def.name} 장착`)
    this.emitInventory()
    this.emitVitals(true)
  }

  unequipArmor(part) {
    const cur = this.armor[part]
    if (!cur) return
    const def = ITEMS[cur.id]
    this.armor[part] = null
    const added = this.addItem(cur.id, 1)
    if (added === 0) {
      this.armor[part] = cur
      this.showToast('인벤토리가 가득 찼습니다', true)
      return
    }
    this.showToast(`🛡️ ${def.name} 해제`)
    this.emitVitals(true)
  }

  // ------------------------------------------------------------------ 제작/조리

  craft(recipeId) {
    const recipe = RECIPES.find((r) => r.id === recipeId)
    if (!recipe) return false
    const ok = recipe.cost.every((c) => this.countItem(c.id) >= c.count)
    if (!ok) return false
    for (const c of recipe.cost) this.removeItems(c.id, c.count)
    const added = this.addItem(recipe.output.id, recipe.output.count)
    if (added > 0) {
      const def = ITEMS[recipe.output.id]
      this.showToast(`🔨 ${def.name} x${added} 제작`)
    }
    this.emitInventory()
    return added > 0
  }

  cook(recipeId) {
    const recipe = COOK_RECIPES.find((r) => r.id === recipeId)
    if (!recipe) return false
    if (this.countItem(recipe.input) < 1) {
      this.showToast('재료가 부족합니다', true)
      return false
    }
    if (this.countItem(recipe.fuel) < recipe.fuelCount) {
      this.showToast('연료(석탄)가 부족합니다', true)
      return false
    }
    this.removeItems(recipe.input, 1)
    this.removeItems(recipe.fuel, recipe.fuelCount)
    const added = this.addItem(recipe.output, 1)
    if (added > 0) this.showToast(`🔥 ${ITEMS[recipe.output].name} x${added} 조리`)
    return added > 0
  }

  // ------------------------------------------------------------------ 생명력/허기

  emitVitals(force = false) {
    const rh = Math.round(this.health)
    const ru = Math.round(this.hunger)
    const ra = this.armorPoints()
    if (!force && rh === this.lastVitals.health && ru === this.lastVitals.hunger && ra === this.lastVitals.armor) {
      return
    }
    this.lastVitals = { health: rh, hunger: ru, armor: ra }
    this.onVitals({
      health: this.health,
      hunger: this.hunger,
      armor: ra,
      maxHealth: MAX_HEALTH,
      maxHunger: MAX_HUNGER,
    })
  }

  applyDamage(amount, text) {
    if (amount <= 0) return
    const points = Math.min(20, this.armorPoints())
    const reduced = amount * (1 - points / 25)
    this.health = Math.max(0, this.health - reduced)
    this.emitVitals(true)
    if (text) this.showToast(`💔 ${text}`, true)
    if (this.health <= 0) this.die()
  }

  die() {
    const sx = Math.floor(WORLD_X / 2)
    const sz = Math.floor(WORLD_Z / 2)
    const sy = this.world.surfaceHeight(sx, sz)
    this.pos.set(sx + 0.5, sy + EPS, sz + 0.5)
    this.vel.set(0, 0, 0)
    this.health = MAX_HEALTH
    this.hunger = MAX_HUNGER
    this.maxFallY = this.pos.y
    this.wasAirborne = false
    this.regenTimer = 0
    this.starveTimer = 0
    this.showToast('💀 쓰러졌습니다. 다시 일어납니다.', true)
    this.emitVitals(true)
    this.applyCamera()
  }

  updateVitals(dt, moving, sprinting) {
    let drain = 0.012
    if (moving) drain += sprinting ? 0.09 : 0.03
    this.hunger = Math.max(0, this.hunger - drain * dt)

    if (this.hunger >= 18 && this.health < MAX_HEALTH) {
      this.regenTimer += dt
      if (this.regenTimer >= 4) {
        this.regenTimer = 0
        this.health = Math.min(MAX_HEALTH, this.health + 1)
        this.hunger = Math.max(0, this.hunger - 0.5)
      }
    } else {
      this.regenTimer = 0
    }

    if (this.hunger <= 0) {
      this.starveTimer += dt
      if (this.starveTimer >= 4) {
        this.starveTimer = 0
        this.applyDamage(1, '굶주림')
      }
    } else {
      this.starveTimer = 0
    }

    this.emitVitals()
  }

  // ------------------------------------------------------------------ 사용/설치

  useHeld() {
    if (!this.active || this.isUiOpen()) return
    // 화로를 바라보면 화로 UI 열기
    if (this.hit) {
      const bid = this.world.get(this.hit.x, this.hit.y, this.hit.z)
      if (bid === ITEM.FURNACE) {
        this.openFurnace()
        return
      }
    }
    const held = this.getSelectedItem()
    if (!held) return
    const def = ITEMS[held.id]
    if (!def) return
    if (def.food) {
      this.eat()
      return
    }
    if (def.block) this.placeBlock()
  }

  eat() {
    const held = this.getSelectedItem()
    const def = held ? ITEMS[held.id] : null
    if (!def || !def.food) return false
    if (this.hunger >= MAX_HUNGER) {
      this.showToast('허기가 이미 가득 찼습니다', true)
      return false
    }
    this.removeItems(held.id, 1)
    this.hunger = Math.min(MAX_HUNGER, this.hunger + def.food.hunger)
    this.showToast(`🍖 ${def.name} 섭취 (허기 +${def.food.hunger})`)
    this.emitVitals(true)
    return true
  }

  placeBlock() {
    if (!this.hit) return
    const held = this.getSelectedItem()
    if (!held) return
    const def = ITEMS[held.id]
    if (!def || !def.block) return

    const nx = this.hit.x + this.hit.nx
    const ny = this.hit.y + this.hit.ny
    const nz = this.hit.z + this.hit.nz
    if (!this.world.inBounds(nx, ny, nz)) return
    if (this.world.get(nx, ny, nz) !== 0) return
    if (this.blockIntersectsPlayer(nx, ny, nz)) return

    this.world.set(nx, ny, nz, held.id)
    this.updateChunkFor(nx, nz)
    this.removeItems(held.id, 1)
  }

  blockIntersectsPlayer(bx, by, bz) {
    return (
      this.pos.x + HALF_W > bx &&
      this.pos.x - HALF_W < bx + 1 &&
      this.pos.y + HEIGHT > by &&
      this.pos.y < by + 1 &&
      this.pos.z + HALF_W > bz &&
      this.pos.z - HALF_W < bz + 1
    )
  }

  // ------------------------------------------------------------------ 동물

  groundHeight(x, z) {
    for (let y = WORLD_Y - 1; y >= 0; y -= 1) {
      const id = this.world.get(x, y, z)
      if (id === 0 || id === ITEM.LEAVES || id === ITEM.LOG) continue
      return y + 1
    }
    return 1
  }

  spawnMob(initial = false) {
    if (this.mobs.length >= MOB_MAX) return
    const type = Math.random() < 0.5 ? 'cow' : 'pig'
    const def = MOB_TYPES[type]
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const ang = Math.random() * Math.PI * 2
      const r = initial ? 6 + Math.random() * 18 : 10 + Math.random() * 20
      const x = Math.round(this.pos.x + Math.cos(ang) * r)
      const z = Math.round(this.pos.z + Math.sin(ang) * r)
      if (x < 2 || x >= WORLD_X - 2 || z < 2 || z >= WORLD_Z - 2) continue
      const y = this.groundHeight(x, z)
      if (y >= WORLD_Y - 3) continue
      const foot = this.world.get(x, y, z)
      const head = this.world.get(x, y + 1, z)
      if ((foot !== 0 && foot !== ITEM.LEAVES) || (head !== 0 && head !== ITEM.LEAVES)) continue

      const obj = createMobObject(type)
      const pos = new THREE.Vector3(x + 0.5, y, z + 0.5)
      obj.position.copy(pos)
      const mob = {
        type,
        def,
        obj,
        pos,
        yaw: Math.random() * Math.PI * 2,
        targetYaw: Math.random() * Math.PI * 2,
        wanderTimer: Math.random() * 2,
        moving: true,
        health: def.health,
        hurtTimer: 0,
      }
      obj.userData.mobRef = mob
      obj.rotation.y = mob.yaw
      this.mobGroup.add(obj)
      this.mobs.push(mob)
      return
    }
  }

  updateMobs(dt) {
    for (const mob of this.mobs) {
      mob.wanderTimer -= dt
      if (mob.wanderTimer <= 0) {
        mob.wanderTimer = 1.5 + Math.random() * 3
        mob.targetYaw = Math.random() * Math.PI * 2
        mob.moving = Math.random() > 0.25
      }
      if (mob.hurtTimer > 0) mob.hurtTimer -= dt

      if (mob.moving) {
        let diff = mob.targetYaw - mob.yaw
        diff = ((diff + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI
        mob.yaw += Math.max(-2.5 * dt, Math.min(2.5 * dt, diff))
        const dx = -Math.sin(mob.yaw)
        const dz = -Math.cos(mob.yaw)
        const nx = mob.pos.x + dx * mob.def.speed * dt
        const nz = mob.pos.z + dz * mob.def.speed * dt
        if (nx > 1.5 && nx < WORLD_X - 1.5 && nz > 1.5 && nz < WORLD_Z - 1.5) {
          const cur = this.groundHeight(Math.floor(mob.pos.x), Math.floor(mob.pos.z))
          const next = this.groundHeight(Math.floor(nx), Math.floor(nz))
          if (Math.abs(next - cur) <= 1) {
            mob.pos.x = nx
            mob.pos.z = nz
          } else {
            mob.wanderTimer = 0
          }
        } else {
          mob.wanderTimer = 0
        }
      }

      const gy = this.groundHeight(Math.floor(mob.pos.x), Math.floor(mob.pos.z))
      mob.pos.y = gy
      mob.obj.position.copy(mob.pos)
      mob.obj.rotation.y = mob.yaw
      // 피격 시 깜빡임
      mob.obj.visible = !(mob.hurtTimer > 0 && Math.floor(mob.hurtTimer * 20) % 2 === 0)
    }
  }

  tryAttack() {
    if (!this.mobGroup.children.length) return false
    this.raycaster.setFromCamera(this.ndc, this.camera)
    const hits = this.raycaster.intersectObjects(this.mobGroup.children, true)
    if (!hits.length) return false
    const first = hits[0]
    if (first.distance > REACH) return false
    // 블록에 가려져 있으면 무시
    if (this.hit) {
      const bx = this.hit.x + 0.5
      const by = this.hit.y + 0.5
      const bz = this.hit.z + 0.5
      const blockDist = this.raycaster.ray.origin.distanceTo(new THREE.Vector3(bx, by, bz)) - 0.9
      if (first.distance > blockDist) return false
    }
    let node = first.object
    while (node && !node.userData.mobRef) node = node.parent
    const mob = node ? node.userData.mobRef : null
    if (!mob) return false
    this.damageMob(mob)
    return true
  }

  damageMob(mob) {
    const held = this.getSelectedItem()
    const heldDef = held ? ITEMS[held.id] : null
    const dmg = heldDef && heldDef.kind ? 3 : 2
    mob.health -= dmg
    mob.hurtTimer = 0.3
    if (mob.health <= 0) this.killMob(mob)
  }

  killMob(mob) {
    const parts = []
    for (const d of mob.def.drops) {
      const n = d.min + Math.floor(Math.random() * (d.max - d.min + 1))
      if (n <= 0) continue
      this.addItem(d.id, n)
      parts.push(`${ITEMS[d.id].name} x${n}`)
    }
    this.mobGroup.remove(mob.obj)
    const i = this.mobs.indexOf(mob)
    if (i >= 0) this.mobs.splice(i, 1)
    this.showToast(`🐄 ${mob.def.name} 처치 · ${parts.join(', ')}`)
  }

  snapshot() {
    return {
      slots: this.slots.map((s) => (s ? { id: s.id, count: s.count } : null)),
      hotbarIndex: this.hotbarIndex,
      armor: {
        helmet: this.armor.helmet ? { ...this.armor.helmet } : null,
        chest: this.armor.chest ? { ...this.armor.chest } : null,
        legs: this.armor.legs ? { ...this.armor.legs } : null,
        boots: this.armor.boots ? { ...this.armor.boots } : null,
      },
      armorPoints: this.armorPoints(),
    }
  }

  emitInventory() {
    this.onInventory(this.snapshot())
  }

  showToast(text, warning = false) {
    if (warning) {
      if (this.toastCooldown > 0) return
      this.toastCooldown = 0.75
    }
    this.toastSeq += 1
    this.onToast({ id: this.toastSeq, text, warning })
  }

  emitMining(p) {
    this.onMining(p)
  }

  // ------------------------------------------------------------------ 청크

  buildAllChunks() {
    for (let cx = 0; cx < CHUNKS_X; cx += 1) {
      for (let cz = 0; cz < CHUNKS_Z; cz += 1) {
        this.rebuildChunk(cx, cz)
      }
    }
  }

  rebuildChunk(cx, cz) {
    if (cx < 0 || cx >= CHUNKS_X || cz < 0 || cz >= CHUNKS_Z) return
    const key = `${cx},${cz}`
    const old = this.chunks.get(key)
    if (old) {
      this.chunkGroup.remove(old)
      old.geometry.dispose()
    }
    const geometry = buildChunkGeometry(this.world, cx, cz)
    const mesh = new THREE.Mesh(geometry, this.material)
    this.chunkGroup.add(mesh)
    this.chunks.set(key, mesh)
  }

  updateChunkFor(x, z) {
    const cx = Math.floor(x / CHUNK_SIZE)
    const cz = Math.floor(z / CHUNK_SIZE)
    this.rebuildChunk(cx, cz)
    if (x % CHUNK_SIZE === 0) this.rebuildChunk(cx - 1, cz)
    if (x % CHUNK_SIZE === CHUNK_SIZE - 1) this.rebuildChunk(cx + 1, cz)
    if (z % CHUNK_SIZE === 0) this.rebuildChunk(cx, cz - 1)
    if (z % CHUNK_SIZE === CHUNK_SIZE - 1) this.rebuildChunk(cx, cz + 1)
  }

  // ------------------------------------------------------------------ 루프

  loop = () => {
    if (!this.running) return
    const now = performance.now()
    let dt = (now - this.clockLast) / 1000
    this.clockLast = now
    if (!Number.isFinite(dt) || dt < 0) dt = 0
    if (dt > 0.05) dt = 0.05

    this.update(dt)
    this.renderer.render(this.scene, this.camera)

    this.fpsAccumulator += dt
    this.fpsFrames += 1
    if (this.fpsAccumulator >= 0.5) {
      this.onFps(Math.round(this.fpsFrames / this.fpsAccumulator))
      this.fpsAccumulator = 0
      this.fpsFrames = 0
    }

    this.rafId = requestAnimationFrame(this.loop)
  }

  applyCamera() {
    this.camera.position.set(this.pos.x, this.pos.y + EYE, this.pos.z)
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ')
    this.camera.updateMatrixWorld()
  }

  update(dt) {
    this.toastCooldown = Math.max(0, this.toastCooldown - dt)
    if (!this.active || this.isUiOpen()) {
      this.emitMining(0)
      return
    }
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw))
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw))

    const wish = new THREE.Vector3()
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) wish.add(forward)
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) wish.sub(forward)
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) wish.add(right)
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) wish.sub(right)
    if (wish.lengthSq() > 0) wish.normalize()

    const sprinting = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')
    const space = this.keys.has('Space')
    const moving = wish.lengthSq() > 0

    if (this.fly) {
      const speed = FLY_SPEED
      this.vel.x = wish.x * speed
      this.vel.z = wish.z * speed
      let vy = 0
      if (space) vy += speed
      if (sprinting) vy -= speed
      this.vel.y = vy
    } else {
      const speed = sprinting ? SPRINT_SPEED : WALK_SPEED
      this.vel.x = wish.x * speed
      this.vel.z = wish.z * speed
      this.vel.y -= GRAVITY * dt
      if (space && this.onGround) {
        this.vel.y = JUMP_SPEED
        this.onGround = false
        this.hunger = Math.max(0, this.hunger - 0.15)
      }
    }

    this.onGround = false
    this.tryMove('x', this.vel.x * dt)
    this.tryMove('z', this.vel.z * dt)
    this.tryMove('y', this.vel.y * dt)

    this.pos.y = Math.max(0, Math.min(WORLD_Y - HEIGHT, this.pos.y))

    this.updateFallDamage()

    this.attackCooldown = Math.max(0, this.attackCooldown - dt)
    this.updateVitals(dt, moving, sprinting)
    this.updateMobs(dt)

    this.mobTimer -= dt
    if (this.mobTimer <= 0) {
      this.mobTimer = MOB_SPAWN_INTERVAL
      this.spawnMob()
    }

    this.applyCamera()
    this.updateHighlight()
    this.updateMining(dt)
  }

  updateFallDamage() {
    if (this.fly) {
      this.maxFallY = this.pos.y
      this.wasAirborne = false
      return
    }
    if (this.onGround) {
      if (this.wasAirborne) {
        const dist = this.maxFallY - this.pos.y
        if (dist > 3) this.applyDamage(Math.floor(dist - 3), '낙하 데미지')
      }
      this.maxFallY = this.pos.y
      this.wasAirborne = false
    } else {
      this.maxFallY = Math.max(this.maxFallY, this.pos.y)
      this.wasAirborne = true
    }
  }

  tryMove(axis, amount) {
    if (amount === 0) return
    this.pos[axis] += amount

    const minX = Math.floor(this.pos.x - HALF_W + EPS)
    const maxX = Math.floor(this.pos.x + HALF_W - EPS)
    const minY = Math.floor(this.pos.y + EPS)
    const maxY = Math.floor(this.pos.y + HEIGHT - EPS)
    const minZ = Math.floor(this.pos.z - HALF_W + EPS)
    const maxZ = Math.floor(this.pos.z + HALF_W - EPS)

    for (let x = minX; x <= maxX; x += 1) {
      for (let y = minY; y <= maxY; y += 1) {
        for (let z = minZ; z <= maxZ; z += 1) {
          if (!this.world.isSolid(x, y, z)) continue
          if (axis === 'x') {
            this.pos.x = amount > 0 ? x - HALF_W - EPS : x + 1 + HALF_W + EPS
            this.vel.x = 0
          } else if (axis === 'z') {
            this.pos.z = amount > 0 ? z - HALF_W - EPS : z + 1 + HALF_W + EPS
            this.vel.z = 0
          } else if (amount > 0) {
            this.pos.y = y - HEIGHT - EPS
            this.vel.y = 0
          } else {
            this.pos.y = y + 1 + EPS
            this.vel.y = 0
            this.onGround = true
          }
          return
        }
      }
    }
  }

  // ------------------------------------------------------------------ 레이캐스트

  raycast() {
    const origin = new THREE.Vector3(this.pos.x, this.pos.y + EYE, this.pos.z)
    const dir = new THREE.Vector3()
    this.camera.getWorldDirection(dir)

    let x = Math.floor(origin.x)
    let y = Math.floor(origin.y)
    let z = Math.floor(origin.z)

    const stepX = Math.sign(dir.x)
    const stepY = Math.sign(dir.y)
    const stepZ = Math.sign(dir.z)

    const tDeltaX = dir.x !== 0 ? Math.abs(1 / dir.x) : Infinity
    const tDeltaY = dir.y !== 0 ? Math.abs(1 / dir.y) : Infinity
    const tDeltaZ = dir.z !== 0 ? Math.abs(1 / dir.z) : Infinity

    let tMaxX = dir.x !== 0 ? (stepX > 0 ? x + 1 - origin.x : origin.x - x) / Math.abs(dir.x) : Infinity
    let tMaxY = dir.y !== 0 ? (stepY > 0 ? y + 1 - origin.y : origin.y - y) / Math.abs(dir.y) : Infinity
    let tMaxZ = dir.z !== 0 ? (stepZ > 0 ? z + 1 - origin.z : origin.z - z) / Math.abs(dir.z) : Infinity

    let nx = 0
    let ny = 0
    let nz = 0

    for (let i = 0; i < 256; i += 1) {
      if (this.world.isSolid(x, y, z)) {
        return { x, y, z, nx, ny, nz }
      }
      if (tMaxX <= tMaxY && tMaxX <= tMaxZ) {
        if (tMaxX > REACH) break
        x += stepX
        tMaxX += tDeltaX
        nx = -stepX
        ny = 0
        nz = 0
      } else if (tMaxY <= tMaxZ) {
        if (tMaxY > REACH) break
        y += stepY
        tMaxY += tDeltaY
        nx = 0
        ny = -stepY
        nz = 0
      } else {
        if (tMaxZ > REACH) break
        z += stepZ
        tMaxZ += tDeltaZ
        nx = 0
        ny = 0
        nz = -stepZ
      }
    }
    return null
  }

  updateHighlight() {
    this.hit = this.raycast()
    if (this.hit) {
      this.highlight.visible = true
      this.highlight.position.set(this.hit.x + 0.5, this.hit.y + 0.5, this.hit.z + 0.5)
    } else {
      this.highlight.visible = false
    }
  }

  // ---------------------------------------------------------- 채굴 (시간 기반)

  updateMining(dt) {
    if (!this.miningHeld) {
      this.miningTarget = null
      this.miningProgress = 0
      this.emitMining(0)
      return
    }

    // 1) 사거리 안에 동물이 있으면 공격 우선
    if (this.attackCooldown <= 0 && this.tryAttack()) {
      this.attackCooldown = ATTACK_COOLDOWN
      this.miningTarget = null
      this.miningProgress = 0
      this.emitMining(0)
      return
    }

    // 2) 블록 채굴
    if (!this.hit) {
      this.miningTarget = null
      this.miningProgress = 0
      this.emitMining(0)
      return
    }
    const { x, y, z } = this.hit
    const id = this.world.get(x, y, z)
    const props = BLOCK_PROPS[id]
    if (!props || props.hardness === Infinity) {
      this.miningProgress = 0
      this.emitMining(0)
      return
    }

    // 조준한 블록이 바뀌면 진행도 초기화
    if (
      !this.miningTarget ||
      this.miningTarget.x !== x ||
      this.miningTarget.y !== y ||
      this.miningTarget.z !== z
    ) {
      this.miningTarget = { x, y, z }
      this.miningProgress = 0
    }

    const held = this.getSelectedItem()
    if (!canHarvest(id, held)) {
      this.miningProgress = 0
      this.emitMining(0)
      const heldItem = held ? ITEMS[held.id] : null
      const alt = heldItem ? ` (${heldItem.name}으로는 불가)` : ''
      this.showToast(`⛔ ${requiredToolText(id)}${alt}`, true)
      return
    }

    const speed = miningSpeed(id, held)
    this.miningProgress += dt * speed
    this.emitMining(Math.min(1, this.miningProgress / props.hardness))

    if (this.miningProgress >= props.hardness) {
      this.breakBlock()
      this.miningProgress = 0
      this.miningTarget = null
      this.emitMining(0)
    }
  }

  breakBlock() {
    if (!this.hit) return
    const { x, y, z } = this.hit
    const id = this.world.get(x, y, z)
    const props = BLOCK_PROPS[id]
    if (!props || props.hardness === Infinity) return
    if (!canHarvest(id, this.getSelectedItem())) return

    this.world.set(x, y, z, 0)
    this.updateChunkFor(x, z)
    this.hunger = Math.max(0, this.hunger - 0.1)

    if (props.drops) {
      const added = this.addItem(props.drops, 1)
      if (added > 0) {
        const def = ITEMS[props.drops]
        this.showToast(`+${added} ${def.name}`)
      }
    }
  }

  // 디버그/테스트용
  getInfo() {
    return {
      position: { x: this.pos.x, y: this.pos.y, z: this.pos.z },
      onGround: this.onGround,
      fly: this.fly,
      active: this.active,
      locked: this.locked,
      lockBlocked: this.lockBlocked,
      inventoryOpen: this.inventoryOpen,
      furnaceOpen: this.furnaceOpen,
      hotbarIndex: this.hotbarIndex,
      held: this.getSelectedItem(),
      hit: this.hit,
      slots: this.snapshot().slots,
      armor: this.snapshot().armor,
      armorPoints: this.armorPoints(),
      health: this.health,
      hunger: this.hunger,
      mobCount: this.mobs.length,
      blocks: this.world.data.length,
    }
  }
}
