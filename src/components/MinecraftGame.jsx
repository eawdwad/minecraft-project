import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import MinecraftEngine from '../three/MinecraftEngine'
import { ITEMS, RECIPES, TIER_NAME } from '../three/items'
import { tileDataURL } from '../three/textures'

const INITIAL_STATE = {
  running: false,
  locked: false,
  fallback: false,
  lockBlocked: false,
  inventoryOpen: false,
}

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

export default function MinecraftGame() {
  const containerRef = useRef(null)
  const engineRef = useRef(null)
  const miningRef = useRef(null)

  const [state, setState] = useState(INITIAL_STATE)
  const [inventory, setInventory] = useState({ slots: new Array(INVENTORY_SIZE).fill(null), hotbarIndex: 0 })
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
      if (!state.running || state.inventoryOpen) return
      engineRef.current?.cycleHotbar(event.deltaY > 0 ? 1 : -1)
    }
    window.addEventListener('keydown', handleKey)
    window.addEventListener('wheel', handleWheel, { passive: true })
    return () => {
      window.removeEventListener('keydown', handleKey)
      window.removeEventListener('wheel', handleWheel)
    }
  }, [state.running, state.inventoryOpen])

  const start = useCallback(() => engineRef.current?.start(), [])

  const { running, locked, fallback, lockBlocked, inventoryOpen } = state
  const { slots, hotbarIndex } = inventory
  const held = slots[hotbarIndex]

  const craftable = useMemo(
    () =>
      RECIPES.map((r) => ({
        recipe: r,
        ok: r.cost.every((c) => countIn(slots, c.id) >= c.count),
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

        {!running && (
          <div className="mc__overlay">
            <h2>⛏️ 미니 마인크래프트</h2>
            <p>블록을 캐서 재료를 모으고, 도구를 제작해 더 단단한 블록을 캐보세요.</p>
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
                <div className="mc__inv-label">보관함</div>
                <div className="mc__grid">
                  {slots.map((slot, i) => (
                    <Slot
                      key={i}
                      slot={slot}
                      index={i}
                      active={i === hotbarIndex}
                      showKey={i < HOTBAR_SIZE}
                      onClick={() => {
                        if (i < HOTBAR_SIZE) engineRef.current?.setHotbarIndex(i)
                        else engineRef.current?.swapWithHotbar(i)
                      }}
                    />
                  ))}
                </div>
                <p className="mc__inv-note">
                  핫바(1~9)를 고른 뒤 보관함 칸을 클릭하면 서로 바뀝니다.
                </p>
              </div>

              <div className="mc__inv-right">
                <div className="mc__inv-label">제작</div>
                <div className="mc__recipes">
                  {craftable.map(({ recipe, ok }) => (
                    <div key={recipe.id} className={`mc__recipe${ok ? '' : ' mc__recipe--off'}`}>
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
                      <button
                        type="button"
                        className="mc__craft"
                        disabled={!ok}
                        onClick={() => engineRef.current?.craft(recipe.id)}
                      >
                        제작
                      </button>
                    </div>
                  ))}
                </div>
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
              {held && ITEMS[held.id].kind ? ` · ${TIER_NAME[ITEMS[held.id].tier]} ${ITEMS[held.id].kind === 'pickaxe' ? '곡괭이' : ITEMS[held.id].kind === 'axe' ? '도끼' : '삽'}` : ''}
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
        <span>{locked ? '마우스 시점 · 좌클릭 꾹 캐기 · 우클릭 설치' : '드래그 시점 · 좌클릭 꾹 캐기 · 우클릭 설치'}</span>
        <span>
          <kbd>1</kbd>~<kbd>9</kbd> / 휠 아이템 선택
        </span>
      </div>
    </div>
  )
}
