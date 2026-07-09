import { useState } from 'react'
import { Company } from '../types'
import { useCompanies, useCreateCompany, useToggleCompanySuspend } from '../hooks/queries'

export default function SuperAdminCompanies() {
  const { data: companies } = useCompanies()
  const createCompany = useCreateCompany()
  const toggleSuspend = useToggleCompanySuspend()

  const [form, setForm] = useState({
    name: '',
    max_owners: 2,
    max_staff: 3,
    owner_email: '',
    owner_password: '',
  })
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await createCompany.mutateAsync(form)
      setForm({ name: '', max_owners: 2, max_staff: 3, owner_email: '', owner_password: '' })
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Could not create company')
    }
  }

  const handleToggleSuspend = (c: Company) => {
    const next = c.subscription_status === 'active' ? 'suspended' : 'active'
    toggleSuspend.mutate({ id: c.id, status: next })
  }

  if (!companies) return <p className="text-slate-400 text-sm">Loading...</p>

  return (
    <div>
      <h2 className="text-xl font-semibold mb-1">Companies</h2>
      <p className="text-sm text-slate-400 mb-6">Create a new client company and decide who its first Owner is.</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card h-fit">
          <h3 className="font-semibold mb-3 text-sm">Create a New Company</h3>
          {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-3">{error}</div>}
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="label">Company Name</label>
              <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Owner Seats</label>
                <input type="number" min={1} className="input" required value={form.max_owners} onChange={(e) => setForm({ ...form, max_owners: Number(e.target.value) })} />
              </div>
              <div>
                <label className="label">Staff Seats</label>
                <input type="number" min={0} className="input" required value={form.max_staff} onChange={(e) => setForm({ ...form, max_staff: Number(e.target.value) })} />
              </div>
            </div>
            <div>
              <label className="label">First Owner's Email</label>
              <input type="email" className="input" required value={form.owner_email} onChange={(e) => setForm({ ...form, owner_email: e.target.value })} />
            </div>
            <div>
              <label className="label">First Owner's Temporary Password</label>
              <input type="text" className="input" required minLength={6} value={form.owner_password} onChange={(e) => setForm({ ...form, owner_password: e.target.value })} placeholder="Share this with them directly" />
            </div>
            <button className="btn-primary w-full" disabled={createCompany.isPending}>{createCompany.isPending ? 'Creating...' : 'Create Company'}</button>
          </form>
        </div>

        <div className="lg:col-span-2 card overflow-x-auto">
          <h3 className="font-semibold mb-3 text-sm">All Companies</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-100">
                <th className="pb-2">Name</th>
                <th className="pb-2">Owners</th>
                <th className="pb-2">Staff</th>
                <th className="pb-2">Status</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id} className="border-b border-slate-50">
                  <td className="py-2">{c.name}</td>
                  <td className="py-2">{c.owner_count} / {c.max_owners}</td>
                  <td className="py-2">{c.staff_count} / {c.max_staff}</td>
                  <td className="py-2 capitalize">
                    <span className={c.subscription_status === 'active' ? 'text-green-600' : 'text-red-500'}>
                      {c.subscription_status}
                    </span>
                  </td>
                  <td className="py-2">
                    <button className="text-xs text-brand-600 hover:underline" onClick={() => handleToggleSuspend(c)}>
                      {c.subscription_status === 'active' ? 'Suspend' : 'Activate'}
                    </button>
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