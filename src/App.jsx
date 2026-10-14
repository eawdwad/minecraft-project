import MinecraftGame from './components/MinecraftGame'
import './App.css'

function App() {
  return (
    <main className="page">
      <header className="page__header">
        <h1 className="page__title">⛏️ 미니 마인크래프트</h1>
        <p className="page__subtitle">Three.js로 만든 브라우저 복셀 샌드박스</p>
      </header>
      <MinecraftGame />
    </main>
  )
}

export default App
