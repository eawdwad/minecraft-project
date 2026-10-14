import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import MinecraftEngine from '../three/MinecraftEngine'
import { ITEMS, RECIPES, COOK_RECIPES, TIER_NAME, ARMOR_PARTS, ARMOR_PART_NAME } from '../three/items'
import { tileDataURL } from '../three/textures'

const INITIAL_STATE = {
  running: false,
  locked: false,
  fallback: false,
  lockBlocked: false,
  inventoryOpen: false,
  furnaceOpen: false,
}

const INITIAL_VITALS = { health: 20, hunger: 20, armor: 0, maxHealth: 20, maxHunger: 20 }

const HOTBAR_SIZE = 9
const INVENTORY_SIZE = 36

// 전체 아이템 아이콘 (한 번만 생성)
let iconCache = null
const getIcons = () => {
  if (!iconCache) {
    iconCache = {}
    for (const [id, def] of Object.entries(ITEMS)) {
      iconCache[id] = tileDataURL(def.tile)
    }
  }
  return iconCache
}

const countIn = (slots, id) => slots.reduce((n, s) => (s && s.id === id ? n + s.count : n), 0)

function Slot({ slot, active, onClick, showKey, index }) {
  const icons = getIcons()
  return (
    <button
      type="button"
      className={`slot${active ? ' slot--active' : ''}`}
      onClick={onClick}
      title={slot ? ITEMS[slot.id].name : ''}
      aria-label={slot ? ITEMS[slot.id].name : '빈 칸'}
    >
      {slot && <img src={icons[slot.id]} alt="" />}
      {slot && slot.count > 1 && <span className="slot__count">{slot.count}</span>}
      {showKey && <span className="slot__key">{index + 1}</span>}
    </button>
  )
}

function VitalsBar({ value, max, icon, label, tone }) {
  const pct = Math.max(0, Math.min(1, value / max)) * 100
  return (
    <div className="vitals" title={`${label} ${Math.round(value)}/${max}`}>
      <span className="vitals__icon">{icon}</span>
      <span className={`vitals__track vitals__track--${tone}`}>
        <span className="vitals__fill" style={{ width: `${pct}%` }} />
      </span>
      <span className="vitals__num">
        {Math.round(value)}/{max}
      </span>
    </div>
  )
}

function RecipeRow({ recipe, slots, onCraft, fuel }) {
  const ok = recipe.cost.every((c) => countIn(slots, c.id) >= c.count)
  return (
    <div className={`mc__recipe${ok ? '' : ' mc__recipe--off'}`}>
      <div className="mc__recipe-out">
        <img src={getIcons()[recipe.output.id]} alt="" />
        <span>
          {ITEMS[recipe.output.id].name}
          {recipe.output.count > 1 ? ` x${recipe.output.count}` : ''}
        </span>
      </div>
      <div className="mc__recipe-cost">
        {recipe.cost.map((c) => (
          <span key={c.id} className="mc__cost">
            <img src={getIcons()[c.id]} alt="" />
            <em className={countIn(slots, c.id) >= c.count ? '' : 'mc__cost--lack'}>
              {countIn(slots, c.id)}/{c.count}
            </em>
          </span>
        ))}
      </div>
      <button type="button" className="mc__craft" disabled={!ok} onClick={onCraft}>
        {fuel ? '굽기' : '제작'}
      </button>
    </div>
  )
}

export default function MinecraftGame() {
  const containerRef = useRef(null)
  const engineRef = useRef(null)
  const miningRef = useRef(null)

  const [state, setState] = useState(INITIAL_STATE)
  const [inventory, setInventory] = useState({
    slots: new Array(INVENTORY_SIZE).fill(null),
    hotbarIndex: 0,
    armor: { helmet: null, chest: null, legs: null, boots: null },
    armorPoints: 0,
  })
  const [vitals, setVitals] = useState(INITIAL_VITALS)
  const [fps, setFps] = useState(0)
  const [toasts, setToasts] = useState([])

  const pushToast = useCallback((toast) => {
    setToasts((prev) => [...prev.slice(-3), toast])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toast.id))
    }, 1700)
  }, [])

  useEffect(() => {
    const container = containerRef.current
    const engine = new MinecraftEngine(container, {
      onState: setState,
      onFps: setFps,
      onInventory: setInventory,
      onVitals: setVitals,
      onToast: pushToast,
      onMining: (p) => {
        const el = miningRef.current
        if (!el) return
        el.style.opacity = p > 0 ? '1' : '0'
        if (el.firstChild) el.firstChild.style.width = `${Math.round(p * 100)}%`
      },
    })
    engineRef.current = engine
    if (import.meta.env.DEV) window.__mcEngine = engine

    const observer = new ResizeObserver(() => engine.resize())
    observer.observe(container)

    return () => {
      observer.disconnect()
      engine.destroy()
      engineRef.current = null
    }
  }, [pushToast])

  // 숫자 키 / 마우스 휠로 핫바 선택
  useEffect(() => {
    const handleKey = (event) => {
      if (event.code === 'KeyE') return
      const n = Number(event.key)
      if (n >= 1 && n <= HOTBAR_SIZE) {
        engineRef.current?.setHotbarIndex(n - 1)
      }
    }
    const handleWheel = (event) => {
      if (!state.running || state.inventoryOpen || state.furnaceOpen) return
      engineRef.current?.cycleHotbar(event.deltaY > 0 ? 1 : -1)
    }
    window.addEventListener('keydown', handleKey)
    window.addEventListener('wheel', handleWheel, { passive: true })
    return () => {
      window.removeEventListener('keydown', handleKey)
      window.removeEventListener('wheel', handleWheel)
    }
  }, [state.running, state.inventoryOpen, state.furnaceOpen])

  const start = useCallback(() => engineRef.current?.start(), [])

  const { running, locked, fallback, lockBlocked, inventoryOpen, furnaceOpen } = state
  const { slots, hotbarIndex, armor } = inventory
  const held = slots[hotbarIndex]

  const craftable = useMemo(
    () =>
      RECIPES.map((r) => ({
        recipe: r,
        ok: r.cost.every((c) => countIn(slots, c.id) >= c.count),
      })),
    [slots],
  )

  const cookable = useMemo(
    () =>
      COOK_RECIPES.map((r) => ({
        recipe: {
          id: r.id,
          output: { id: r.output, count: 1 },
          cost: [
            { id: r.input, count: 1 },
            { id: r.fuel, count: r.fuelCount },
          ],
        },
        ok: countIn(slots, r.input) >= 1 && countIn(slots, r.fuel) >= r.fuelCount,
      })),
    [slots],
  )

  return (
    <div className="mc">
      <div className="mc__stage" ref={containerRef}>
        {running && <div className="crosshair" aria-hidden="true" />}
        {running && (
          <div className="mc__mining" ref={miningRef} style={{ opacity: 0 }}>
            <div className="mc__mining-fill" />
          </div>
        )}
        <div className="mc__fps">{fps} FPS</div>

        {running && fallback && <div className="mc__mode">드래그: 시점 회전</div>}

        <div className="mc__toasts">
          {toasts.map((t) => (
            <div key={t.id} className={`mc__toast${t.warning ? ' mc__toast--warn' : ''}`}>
              {t.text}
            </div>
          ))}
        </div>

        {running && (
          <div className="mc__vitals">
            <VitalsBar value={vitals.health} max={vitals.maxHealth} icon="❤️" label="체력" tone="hp" />
            <VitalsBar value={vitals.hunger} max={vitals.maxHunger} icon="🍗" label="허기" tone="hunger" />
            <VitalsBar value={vitals.armor} max={20} icon="🛡️" label="방어" tone="armor" />
          </div>
        )}

        {!running && (
          <div className="mc__overlay">
            <h2>⛏️ 미니 마인크래프트</h2>
            <p>
              블록을 캐서 재료를 모으고, 도구·갑옷을 만들고, 동물을 잡아 화로에 고기를 구워 드세요.
            </p>
            <button type="button" className="mc__btn" onClick={start}>
              게임 시작
            </button>
            <p className="mc__hint">
              {lockBlocked
                ? '이 환경은 포인터 잠금이 제한되어 있어, 드래그로 시점을 회전합니다.'
                : '시작하면 마우스가 고정됩니다. 빠져나오려면 Esc.'}
            </p>
          </div>
        )}

        {running && inventoryOpen && (
          <div className="mc__inv">
            <div className="mc__inv-head">
              <h3>인벤토리 &amp; 제작</h3>
              <button type="button" className="mc__inv-close" onClick={() => engineRef.current?.toggleInventory()}>
                닫기 (E)
              </button>
            </div>

            <div className="mc__inv-body">
              <div className="mc__inv-left">
                <div className="mc__inv-label">장비</div>
                <div className="mc__armor">
                  {ARMOR_PARTS.map((part) => (
                    <div key={part} className="mc__armor-slot">
                      <Slot
                        slot={armor[part]}
                        onClick={() => engineRef.current?.unequipArmor(part)}
                        showKey={false}
                        index={-1}
                      />
                      <span className="mc__armor-name">{ARMOR_PART_NAME[part]}</span>
                    </div>
                  ))}
                  <div className="mc__armor-points">방어 {inventory.armorPoints || 0}/20</div>
                </div>

                <div className="mc__inv-label">보관함</div>
                <div className="mc__grid">
                  {slots.map((slot, i) => (
                    <Slot
                      key={i}
                      slot={slot}
                      index={i}
                      active={i === hotbarIndex}
                      showKey={i < HOTBAR_SIZE}
                      onClick={() => engineRef.current?.clickSlot(i)}
                    />
                  ))}
                </div>
                <p className="mc__inv-note">
                  갑옷을 클릭하면 장착됩니다. 핫바(1~9)를 고른 뒤 보관함 칸을 클릭하면 서로 바뀝니다.
                </p>
              </div>

              <div className="mc__inv-right">
                <div className="mc__inv-label">제작</div>
                <div className="mc__recipes">
                  {craftable.map(({ recipe }) => (
                    <RecipeRow
                      key={recipe.id}
                      recipe={recipe}
                      slots={slots}
                      onCraft={() => engineRef.current?.craft(recipe.id)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {running && furnaceOpen && (
          <div className="mc__inv mc__furnace">
            <div className="mc__inv-head">
              <h3>🔥 화로</h3>
              <button type="button" className="mc__inv-close" onClick={() => engineRef.current?.closeFurnace()}>
                닫기 (Esc)
              </button>
            </div>
            <div className="mc__furnace-body">
              <p className="mc__inv-note">
                석탄을 연료로 날고기를 구울 수 있습니다. 구운 고기는 허기를 더 많이 채웁니다.
              </p>
              <div className="mc__recipes">
                {cookable.map(({ recipe }) => (
                  <RecipeRow
                    key={recipe.id}
                    recipe={recipe}
                    slots={slots}
                    fuel
                    onCraft={() => engineRef.current?.cook(recipe.id)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {running && (
          <div className="hotbar">
            {slots.slice(0, HOTBAR_SIZE).map((slot, index) => (
              <Slot
                key={index}
                slot={slot}
                index={index}
                active={index === hotbarIndex}
                showKey
                onClick={() => engineRef.current?.setHotbarIndex(index)}
              />
            ))}
            <div className="hotbar__name">
              {held ? `${ITEMS[held.id].name}${held.count > 1 ? ` x${held.count}` : ''}` : '빈 손'}
              {held && ITEMS[held.id].kind
                ? ` · ${TIER_NAME[ITEMS[held.id].tier]} ${
                    ITEMS[held.id].kind === 'pickaxe' ? '곡괭이' : ITEMS[held.id].kind === 'axe' ? '도끼' : '삽'
                  }`
                : ''}
              {held && ITEMS[held.id].food ? ' · 우클릭으로 먹기' : ''}
            </div>
          </div>
        )}
      </div>

      <div className="mc__help">
        <span>
          <kbd>W</kbd>
          <kbd>A</kbd>
          <kbd>S</kbd>
          <kbd>D</kbd> 이동
        </span>
        <span>
          <kbd>Space</kbd> 점프 · <kbd>Shift</kbd> 달리기 · <kbd>F</kbd> 비행
        </span>
        <span>
          <kbd>E</kbd> 인벤토리/제작
        </span>
        <span>{locked ? '좌클릭 꾹 캐기/공격 · 우클릭 설치/먹기/화로' : '드래그 시점 · 좌클릭 캐기/공격 · 우클릭 설치/먹기/화로'}</span>
        <span>
          <kbd>1</kbd>~<kbd>9</kbd> / 휠 아이템 선택
        </span>
      </div>
    </div>
  )
}
