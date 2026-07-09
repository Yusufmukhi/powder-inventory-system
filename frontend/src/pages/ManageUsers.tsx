import { useState } from 'react'
import api from '../api/client'
import { useUsers, useCreateUser, useRemoveUser } from '../hooks/queries'

interface UserRow {
  id: string
  email: string
  username?: string | null
  role: 'owner' | 'shop_floor'
  created_at: string
}

interface UsersResponse {
  users: UserRow[]
  company_name: string
  owner_count: number
  staff_count: number
  max_owners: number
  max_staff: number
  subscription_status: string
}

export default function ManageUsers() {
  const { data } = useUsers()
  const usersData = data as UsersResponse | undefined
  const createUser = useCreateUser()
  const removeUserMutation = useRemoveUser()

  const [form, setForm] = useState({ email: '', username: '', password: '', role: 'shop_floor' })
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await createUser.mutateAsync(form)
      setForm({ email: '', username: '', password: '', role: 'shop_floor' })
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Could not create user')
    }
  }

  const removeUser = async (id: string) => {
    if (!confirm('Remove this account? They will no longer be able to log in.')) return
    removeUserMutation.mutate(id)
  }

  const resetPassword = async (id: string, email: string) => {
    const newPassword = prompt(`New temporary password for ${email} (min 6 characters):`)
    if (!newPassword) return
    if (newPassword.length < 6) {
      alert('Password must be at least 6 characters')
      return
    }
    try {
      await api.patch(`/auth/users/${id}/password`, { new_password: newPassword })
      alert(`Password reset. Share the new password with ${email} directly.`)
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Could not reset password')
    }
  }

  if (!usersData) return <p className="text-slate-400 text-sm">Loading...</p>

  const ownerFull = usersData.owner_count >= usersData.max_owners
  const staffFull = usersData.staff_count >= usersData.max_staff

  return (
    <div>
      <p className="text-sm text-slate-500 mb-4">{usersData.company_name}</p>

      <div className="grid grid-cols-2 gap-4 mb-6 max-w-md">
        <div className="card">
          <p className="text-xs text-slate-400 mb-1">Owner seats</p>
          <p className={`text-xl font-bold ${ownerFull ? 'text-red-500' : ''}`}>{usersData.owner_count} / {usersData.max_owners}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-400 mb-1">Staff seats</p>
          <p className={`text-xl font-bold ${staffFull ? 'text-red-500' : ''}`}>{usersData.staff_count} / {usersData.max_staff}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card h-fit">
          <h3 className="font-semibold mb-3 text-sm">Invite a New User</h3>
          {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-3">{error}</div>}
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="label">Username</label>
              <input type="text" className="input" required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="e.g. ravi" />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="label">Temporary Password</label>
              <input type="text" className="input" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Share this with them directly" />
            </div>
            <div>
              <label className="label">Role</label>
              <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="shop_floor" disabled={staffFull}>Shop Floor {staffFull ? '(seats full)' : ''}</option>
                <option value="owner" disabled={ownerFull}>Owner {ownerFull ? '(seats full)' : ''}</option>
              </select>
            </div>
            <button className="btn-primary w-full" disabled={createUser.isPending}>{createUser.isPending ? 'Creating...' : 'Create Account'}</button>
          </form>
        </div>

        <div className="lg:col-span-2 card overflow-x-auto">
          <h3 className="font-semibold mb-3 text-sm">All Accounts</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-100">
                <th className="pb-2">Username</th>
                <th className="pb-2">Email</th>
                <th className="pb-2">Role</th>
                <th className="pb-2">Created</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {usersData.users.map((u) => (
                <tr key={u.id} className="border-b border-slate-50">
                  <td className="py-2 font-medium">{u.username || '—'}</td>
                  <td className="py-2">{u.email}</td>
                  <td className="py-2 capitalize">{u.role.replace('_', ' ')}</td>
                  <td className="py-2 text-slate-500">{new Date(u.created_at).toLocaleDateString('en-IN')}</td>
                  <td className="py-2">
                    <button className="text-brand-500 text-xs hover:underline mr-3" onClick={() => resetPassword(u.id, u.email)}>Reset Password</button>
                    <button className="text-red-400 text-xs hover:underline" onClick={() => removeUser(u.id)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}