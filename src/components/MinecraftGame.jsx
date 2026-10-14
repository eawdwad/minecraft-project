import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import MinecraftEngine from '../three/MinecraftEngine'
import { BLOCKS, HOTBAR, tileDataURL } from '../three/textures'

export default function MinecraftGame() {
  const containerRef = useRef(null)
  const engineRef = useRef(null)

  const [locked, setLocked] = useState(false)
  const [selected, setSelected] = useState(HOTBAR[0])
  const [fps, setFps] = useState(0)

  const items = useMemo(
    () =>
      HOTBAR.map((id) => ({
        id,
        name: BLOCKS[id].name,
        icon: tileDataURL(BLOCKS[id].tiles.side),
      })),
    [],
  )

  useEffect(() => {
    const container = containerRef.current
    const engine = new MinecraftEngine(container, {
      onLockChange: setLocked,
      onFps: setFps,
      selected: HOTBAR[0],
    })
    engineRef.current = engine

    const observer = new ResizeObserver(() => engine.resize())
    observer.observe(container)

    return () => {
      observer.disconnect()
      engine.destroy()
      engineRef.current = null
    }
  }, [])

  useEffect(() => {
    engineRef.current?.setSelected(selected)
  }, [selected])

  // 숫자 키 / 마우스 휠로 블록 선택
  useEffect(() => {
    const handleKey = (event) => {
      const n = Number(event.key)
      if (n >= 1 && n <= HOTBAR.length) setSelected(HOTBAR[n - 1])
    }
    const handleWheel = (event) => {
      if (!locked) return
      setSelected((prev) => {
        const i = HOTBAR.indexOf(prev)
        const next = (i + (event.deltaY > 0 ? 1 : -1) + HOTBAR.length) % HOTBAR.length
        return HOTBAR[next]
      })
    }
    window.addEventListener('keydown', handleKey)
    window.addEventListener('wheel', handleWheel, { passive: true })
    return () => {
      window.removeEventListener('keydown', handleKey)
      window.removeEventListener('wheel', handleWheel)
    }
  }, [locked])

  const start = useCallback(() => engineRef.current?.requestLock(), [])

  return (
    <div className="mc">
      <div className="mc__stage" ref={containerRef}>
        {locked && <div className="crosshair" aria-hidden="true" />}
        <div className="mc__fps">{fps} FPS</div>

        {!locked && (
          <div className="mc__overlay">
            <h2>⛏️ 미니 마인크래프트</h2>
            <p>복셀 월드를 돌아다니며 블록을 캐고 쌓아보세요.</p>
            <button type="button" className="mc__btn" onClick={start}>
              클릭하여 시작
            </button>
            <p className="mc__hint">시작하면 마우스가 고정됩니다. 빠져나오려면 Esc.</p>
          </div>
        )}

        <div className="hotbar">
          {items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={`slot${item.id === selected ? ' slot--active' : ''}`}
              onClick={() => setSelected(item.id)}
              title={item.name}
              aria-label={item.name}
            >
              <img src={item.icon} alt="" />
              <span className="slot__key">{index + 1}</span>
            </button>
          ))}
          <div className="hotbar__name">{BLOCKS[selected].name}</div>
        </div>
      </div>

      <div className="mc__help">
        <span>
          <kbd>W</kbd>
          <kbd>A</kbd>
          <kbd>S</kbd>
          <kbd>D</kbd> 이동
        </span>
        <span>
          <kbd>Space</kbd> 점프 · <kbd>Shift</kbd> 달리기
        </span>
        <span>
          <kbd>F</kbd> 비행 모드
        </span>
        <span>좌클릭 캐기 · 우클릭 설치</span>
        <span>
          <kbd>1</kbd>~<kbd>9</kbd> / 휠 블록 선택
        </span>
      </div>
    </div>
  )
}
