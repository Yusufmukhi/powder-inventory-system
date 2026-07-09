import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const err = await login(email, password)
      if (err) setError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="card w-full max-w-sm">
        <h1 className="text-lg font-bold text-brand-700 mb-1">Powder Coat</h1>
        <p className="text-sm text-slate-400 mb-6">Inventory & Jobs — Log in</p>

        {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">{error}</div>}

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label">Password</label>
            <input type="password" className="input" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button className="btn-primary w-full" disabled={saving}>
            {saving ? 'Logging in...' : 'Log In'}
          </button>
        </form>

        <p className="text-xs text-slate-400 mt-4 text-center">
          Accounts are created by your Owner/administrator — there's no self-signup.
        </p>
      </div>
    </div>
  )
}
