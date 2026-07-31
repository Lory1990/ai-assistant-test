import { lazy, Suspense, useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes, Outlet } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import './App.css'
import { restoreSession, subscribeToAuth, isAuthenticated } from './auth/authStore'
import LoginScreen from './auth/LoginScreen'
import SocialCallback from './auth/SocialCallback'
import { useMe } from './queries'
import { useLiveUpdates } from './ws'
import { SectionLoader } from './components/SectionLoader'
import { ThemeToggle } from './components/ThemeToggle'

const ChatSection = lazy(() => import('./sections/ChatSection'))
const OverviewSection = lazy(() => import('./sections/OverviewSection'))
const FitnessSection = lazy(() => import('./sections/FitnessSection'))
const FoodSection = lazy(() => import('./sections/FoodSection'))
const HomeSection = lazy(() => import('./sections/HomeSection'))
const GoalsSection = lazy(() => import('./sections/GoalsSection'))
const InvestmentsSection = lazy(() => import('./sections/InvestmentsSection'))
const DiarySection = lazy(() => import('./sections/DiarySection'))
const SocialSection = lazy(() => import('./sections/SocialSection'))
const ProfileSection = lazy(() => import('./sections/ProfileSection'))

const SECTIONS = [
  { path: 'chat', label: 'Chat' },
  { path: 'overview', label: 'Panoramica' },
  { path: 'fitness', label: 'Fitness' },
  { path: 'food', label: 'Alimentazione' },
  { path: 'home', label: 'Casa' },
  { path: 'goals', label: 'Obiettivi' },
  { path: 'investments', label: 'Investimenti' },
  { path: 'diary', label: 'Diario' },
  { path: 'social', label: 'Social' },
  { path: 'profile', label: 'Profilo' },
]

function useClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

function DashboardLayout() {
  const { data: me } = useMe()
  const clock = useClock()
  const live = useLiveUpdates()

  if (!me) return null

  return (
    <div className="hud-shell">
      <nav className="hud-sidebar">
        <div className="hud-sidebar__brand">Family HUD</div>
        {SECTIONS.map((s) => (
          <NavLink
            key={s.path}
            to={`/${s.path}`}
            className={({ isActive }) => `hud-sidebar__item ${isActive ? 'is-active' : ''}`}
          >
            {s.label}
          </NavLink>
        ))}
        <div className="hud-sidebar__live" title={live ? 'Aggiornamenti live attivi' : 'Riconnessione...'}>
          <span className={`hud-live-dot ${live ? 'is-live' : ''}`} />
          {live ? 'Live' : 'Riconnessione...'}
        </div>
      </nav>

      <div className="hud-main">
        <header className="hud-header">
          <span className="family-name">{me.team.name}</span>
          <span className="hud-header__right">
            <span className="clock">{clock.toLocaleTimeString('it-IT')}</span>
            <ThemeToggle />
          </span>
        </header>

        <Suspense fallback={<SectionLoader />}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  )
}

function Dashboard() {
  return (
    <Routes>
      <Route element={<DashboardLayout />}>
        <Route index element={<Navigate to="/chat" replace />} />
        <Route path="chat" element={<ChatSection />} />
        <Route path="overview" element={<OverviewSection />} />
        <Route path="fitness" element={<FitnessSection />} />
        <Route path="food" element={<FoodSection />} />
        <Route path="home" element={<HomeSection />} />
        <Route path="goals" element={<GoalsSection />} />
        <Route path="investments" element={<InvestmentsSection />} />
        <Route path="diary" element={<DiarySection />} />
        <Route path="social" element={<SocialSection />} />
        <Route path="profile" element={<ProfileSection />} />
        <Route path="*" element={<Navigate to="/chat" replace />} />
      </Route>
    </Routes>
  )
}

function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    restoreSession().then(setAuthenticated)
    // L'authStore notifica login, logout e sessione scaduta: la dashboard
    // compare e sparisce senza che nessuno debba ricaricare la pagina.
    return subscribeToAuth(() => {
      const next = isAuthenticated()
      // Svuotare la cache al logout: senza questo chi si logga dopo vedrebbe
      // per un istante i dati di chi c'era prima.
      if (!next) queryClient.clear()
      setAuthenticated(next)
    })
  }, [queryClient])

  if (authenticated === null) return null

  // La rotta di callback social deve essere raggiungibile da non autenticati:
  // e' proprio lei che completa il login.
  if (!authenticated) {
    return (
      <Routes>
        <Route path="/auth/callback" element={<SocialCallback />} />
        <Route path="*" element={<LoginScreen />} />
      </Routes>
    )
  }

  return <Dashboard />
}

export default App
