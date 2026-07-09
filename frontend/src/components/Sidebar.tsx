import { NavLink } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import ChangePasswordModal from './ChangePasswordModal'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `block px-4 py-2.5 rounded-lg text-sm font-medium transition ${
    isActive ? 'bg-brand-500 text-white' : 'text-slate-600 hover:bg-slate-100'
  }`

export default function Sidebar() {
  const { session, role, username, logout } = useAuth()
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [justChanged, setJustChanged] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const closeMobile = () => setMobileOpen(false)

  return (
    <>
      {/* Mobile top bar with hamburger — only visible below md */}
      <div className="md:hidden sticky top-0 z-30 flex items-center justify-between bg-white border-b border-slate-200 px-4 py-3">
        <h1 className="text-base font-bold text-brand-700 leading-tight">Powder Coat</h1>
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="p-2 -mr-2 text-slate-600"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Backdrop overlay when mobile drawer is open */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={closeMobile}
        />
      )}

      {/* Sidebar: fixed drawer on mobile, static column on md+ */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 min-h-screen p-4 flex flex-col
          transform transition-transform duration-200 ease-in-out
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0 md:static md:z-auto md:w-56 md:shrink-0`}
      >
        <div className="mb-8 px-2 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-brand-700 leading-tight">Powder Coat</h1>
            <p className="text-xs text-slate-400">Inventory & Jobs</p>
          </div>
          <button
            onClick={closeMobile}
            aria-label="Close menu"
            className="md:hidden p-1 text-slate-400"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav className="space-y-1 flex-1" onClick={closeMobile}>
          {role === 'super_admin' ? (
            <NavLink to="/" end className={linkClass}>Companies</NavLink>
          ) : (
            <>
              <NavLink to="/" end className={linkClass}>Dashboard</NavLink>
              <NavLink to="/jobs" className={linkClass}>Jobs</NavLink>
              <NavLink to="/powders" className={linkClass}>Powder Inventory</NavLink>
              {role === 'owner' && (
                <NavLink to="/expenses" className={linkClass}>Expenses</NavLink>
              )}
              {role === 'owner' && (
                <NavLink to="/company" className={linkClass}>Company Settings</NavLink>
              )}
              <NavLink to="/customers" className={linkClass}>Customers</NavLink>
            </>
          )}
        </nav>
        <div className="px-2 pt-4 border-t border-slate-100">
          <p className="text-xs text-slate-600 font-medium truncate">{username || session?.user?.email}</p>
          <p className="text-xs text-slate-400 truncate">{session?.user?.email}</p>
          <p className="text-xs text-slate-400 capitalize mb-2">{role?.replace('_', ' ')}</p>
          {justChanged && <p className="text-xs text-green-600 mb-2">Password changed.</p>}
          <button className="text-xs text-slate-400 hover:underline block mb-1" onClick={() => setShowPasswordModal(true)}>
            Change Password
          </button>
          <button className="text-xs text-red-400 hover:underline" onClick={logout}>Log out</button>
        </div>
        {showPasswordModal && (
          <ChangePasswordModal
            onDone={() => { setShowPasswordModal(false); setJustChanged(true) }}
            onCancel={() => setShowPasswordModal(false)}
          />
        )}
      </aside>
    </>
  )
}