import * as THREE from 'three'
import { createAtlasTexture, HOTBAR } from './textures'
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

export default class MinecraftEngine {
  constructor(container, options = {}) {
    this.container = container
    this.onState = options.onState || (() => {})
    this.onFps = options.onFps || (() => {})
    this.selected = options.selected ?? HOTBAR[0]

    // active: 게임 진행 중 여부. locked: 포인터 락 사용 여부.
    this.active = false
    this.locked = false
    this.lockBlocked = false // 이 환경에서 포인터 락이 아예 불가능한 경우
    this.dragging = false
    this.dragButton = 0
    this.dragMoved = 0
    this.lastX = 0
    this.lastY = 0

    this.keys = new Set()
    this.fly = false
    this.onGround = false
    this.hit = null

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

    // 바라보는 블록 하이라이트
    this.highlight = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)),
      new THREE.LineBasicMaterial({ color: 0x0a0a0a, transparent: true, opacity: 0.5 }),
    )
    this.highlight.visible = false
    this.scene.add(this.highlight)

    // 플레이어 초기 위치
    const spawnY = this.world.surfaceHeight(Math.floor(WORLD_X / 2), Math.floor(WORLD_Z / 2))
    this.pos = new THREE.Vector3(WORLD_X / 2 + 0.5, spawnY + EPS, WORLD_Z / 2 + 0.5)
    this.vel = new THREE.Vector3()
    this.yaw = 0
    this.pitch = 0

    this.clockLast = performance.now()
    this.fpsAccumulator = 0
    this.fpsFrames = 0
    this.running = true

    this.bindEvents()
    this.applyCamera()
    this.loop()
  }

  // ------------------------------------------------------------- 이벤트 바인딩

  bindEvents() {
    this.handleKeyDown = (e) => {
      this.keys.add(e.code)
      if (e.code === 'KeyF') this.fly = !this.fly
      // 포인터 락을 못 쓰는 환경에서는 Esc로 일시정지
      if (e.code === 'Escape' && this.active && !this.locked) {
        this.active = false
        this.notify()
      }
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault()
      }
    }
    this.handleKeyUp = (e) => this.keys.delete(e.code)
    this.handleBlur = () => this.keys.clear()

    this.handleMouseMove = (e) => {
      if (this.locked) {
        this.yaw -= e.movementX * 0.0022
        this.pitch -= e.movementY * 0.0022
        this.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, this.pitch))
        return
      }
      // 대체 모드: 드래그로 시점 회전
      if (!this.active || !this.dragging) return
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
      if (!this.active) return
      if (this.locked) {
        if (e.button === 0) this.breakBlock()
        else if (e.button === 2) this.placeBlock()
        return
      }
      // 대체 모드: 캔버스 위에서만 드래그 시작 (UI 클릭은 무시)
      if (!this.renderer.domElement.contains(e.target)) return
      this.dragging = true
      this.dragButton = e.button
      this.dragMoved = 0
      this.lastX = e.clientX
      this.lastY = e.clientY
      e.preventDefault()
    }

    this.handleMouseUp = () => {
      if (!this.dragging) return
      const wasClick = this.dragMoved < 6
      const button = this.dragButton
      this.dragging = false
      if (!this.active || this.locked) return
      if (!wasClick) return
      if (button === 0) this.breakBlock()
      else if (button === 2) this.placeBlock()
    }

    this.handleContextMenu = (e) => e.preventDefault()
    this.handlePointerLockChange = () => {
      const locked = document.pointerLockElement === this.renderer.domElement
      this.locked = locked
      if (locked) {
        this.active = true
      } else if (!this.lockBlocked) {
        // 사용자가 Esc로 포인터 락을 해제한 경우 → 일시정지
        this.active = false
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
    document.addEventListener('contextmenu', this.handleContextMenu)
    document.addEventListener('pointerlockchange', this.handlePointerLockChange)
    document.addEventListener('pointerlockerror', this.handlePointerLockError)
    window.addEventListener('resize', this.handleResize)
  }

  // 게임 시작: 포인터 락을 시도하고, 안 되면 드래그 시점 모드로 진행한다.
  start() {
    this.active = true
    this.notify()
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
    })
  }

  setSelected(id) {
    this.selected = id
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
    if (!this.active) return
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
      }
    }

    this.onGround = false
    this.tryMove('x', this.vel.x * dt)
    this.tryMove('z', this.vel.z * dt)
    this.tryMove('y', this.vel.y * dt)

    this.pos.y = Math.max(0, Math.min(WORLD_Y - HEIGHT, this.pos.y))

    this.applyCamera()
    this.updateHighlight()
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

  // ---------------------------------------------------------- 블록 캐기/설치

  breakBlock() {
    if (!this.hit) return
    this.world.set(this.hit.x, this.hit.y, this.hit.z, 0)
    this.updateChunkFor(this.hit.x, this.hit.z)
  }

  placeBlock() {
    if (!this.hit) return
    const nx = this.hit.x + this.hit.nx
    const ny = this.hit.y + this.hit.ny
    const nz = this.hit.z + this.hit.nz
    if (!this.world.inBounds(nx, ny, nz)) return
    if (this.world.get(nx, ny, nz) !== 0) return
    if (this.blockIntersectsPlayer(nx, ny, nz)) return
    this.world.set(nx, ny, nz, this.selected)
    this.updateChunkFor(nx, nz)
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

  // 디버그/테스트용
  getInfo() {
    return {
      position: { x: this.pos.x, y: this.pos.y, z: this.pos.z },
      onGround: this.onGround,
      fly: this.fly,
      active: this.active,
      locked: this.locked,
      lockBlocked: this.lockBlocked,
      selected: this.selected,
      hit: this.hit,
      blocks: this.world.data.length,
    }
  }
}
