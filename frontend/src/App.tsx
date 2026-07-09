import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import Sidebar from './components/Sidebar'
import Login from './pages/Login'
import Suspended from './pages/Suspended'
import { AuthProvider, useAuth } from './context/AuthContext'

// Lazy-loaded so each page's JS (and heavy libs like xlsx) only downloads
// when the user actually visits that page, instead of on every load.
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Jobs = lazy(() => import('./pages/Jobs'))
const PowderInventory = lazy(() => import('./pages/PowderInventory'))
const Customers = lazy(() => import('./pages/Customers'))
const Expenses = lazy(() => import('./pages/Expenses'))
const CompanySettings = lazy(() => import('./pages/CompanySettings'))
const SuperAdminCompanies = lazy(() => import('./pages/SuperAdminCompanies'))

const PageFallback = () => (
  <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">Loading...</div>
)

function AppRoutes() {
  const { session, role, loading, suspended } = useAuth()

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">Loading...</div>
  }

  if (suspended) {
    return <Suspended />
  }

  if (!session) {
    return <Login />
  }

  if (role === 'super_admin') {
    return (
      <BrowserRouter>
        <div className="md:flex">
          <Sidebar />
          <main className="flex-1 p-4 sm:p-6 md:p-8 min-w-0">
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/" element={<SuperAdminCompanies />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </main>
        </div>
      </BrowserRouter>
    )
  }

  return (
    <BrowserRouter>
      <div className="md:flex">
        <Sidebar />
        <main className="flex-1 p-4 sm:p-6 md:p-8 min-w-0">
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/jobs" element={<Jobs />} />
              <Route path="/powders" element={<PowderInventory />} />
              <Route
                path="/expenses"
                element={role === 'owner' ? <Expenses /> : <Navigate to="/" replace />}
              />
              <Route
                path="/company"
                element={role === 'owner' ? <CompanySettings /> : <Navigate to="/" replace />}
              />
              <Route path="/customers" element={<Customers />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
