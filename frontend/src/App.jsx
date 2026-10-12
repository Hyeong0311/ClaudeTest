import { useEffect, useState } from 'react'
import { getVersion } from './api.js'
import ApplyPage from './pages/ApplyPage.jsx'
import DeskPage from './pages/DeskPage.jsx'
import StatusPage from './pages/StatusPage.jsx'
import { Link, usePathname } from './router.jsx'

const PAGES = [
  { path: '/', label: '방문 신청', component: ApplyPage },
  { path: '/status', label: '신청 조회', component: StatusPage },
  { path: '/desk', label: '안내데스크', component: DeskPage },
]

export default function App() {
  const path = usePathname()
  const [version, setVersion] = useState('')
  const page = PAGES.find((p) => p.path === path) ?? PAGES[0]
  const Page = page.component

  useEffect(() => {
    getVersion()
      .then((v) => setVersion(v.version))
      .catch(() => setVersion(''))
  }, [])

  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden="true" />
          방문 출입 관리
        </Link>
        <nav className="nav" aria-label="주요 메뉴">
          {PAGES.map((p) => (
            <Link key={p.path} to={p.path} className={p.path === page.path ? 'nav-link is-active' : 'nav-link'}>
              {p.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="main">
        <Page key={page.path} />
      </main>

      <footer className="footer">
        <span>시연용 프로토타입 · 가상 데이터</span>
        {version && <span>배포 버전 {version.slice(0, 7)}</span>}
      </footer>
    </div>
  )
}
