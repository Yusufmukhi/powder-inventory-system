import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../api/supabaseClient'
import api from '../api/client'

type Role = 'super_admin' | 'owner' | 'shop_floor'

interface AuthContextType {
  session: Session | null
  role: Role | null
  companyId: string | null
  username: string | null
  loading: boolean
  suspended: boolean
  login: (email: string, password: string) => Promise<string | null>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [suspended, setSuspended] = useState(false)

  const fetchRole = async () => {
    try {
      const res = await api.get('/auth/me')
      setRole(res.data.role)
      setCompanyId(res.data.company_id ?? null)
      setUsername(res.data.username ?? null)
      setSuspended(false)
    } catch (err: any) {
      if (err?.response?.status === 402) {
        setSuspended(true)
      }
      setRole(null)
      setCompanyId(null)
      setUsername(null)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      if (data.session) await fetchRole()
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession)
      if (newSession) {
        await fetchRole()
      } else {
        setRole(null)
        setCompanyId(null)
        setUsername(null)
        setSuspended(false)
      }
    })

    const onSuspended = () => setSuspended(true)
    window.addEventListener('subscription-inactive', onSuspended)

    return () => {
      listener.subscription.unsubscribe()
      window.removeEventListener('subscription-inactive', onSuspended)
    }
  }, [])

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error ? error.message : null
  }

  const logout = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, role, companyId, username, loading, suspended, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
