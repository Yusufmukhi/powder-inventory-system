import { useState } from 'react'
import { useCustomers, useCreateCustomer } from '../hooks/queries'

export default function Customers() {
  const { data: customers = [] } = useCustomers()
  const createCustomer = useCreateCustomer()
  const [form, setForm] = useState({ name: '', contact_number: '', address: '' })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    await createCustomer.mutateAsync(form)
    setForm({ name: '', contact_number: '', address: '' })
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6">Customers</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card md:col-span-1 h-fit">
          <h3 className="font-semibold mb-3 text-sm">Add Customer</h3>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="label">Name</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label className="label">Contact Number</label>
              <input className="input" value={form.contact_number} onChange={(e) => setForm({ ...form, contact_number: e.target.value })} />
            </div>
            <div>
              <label className="label">Address</label>
              <textarea className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <button className="btn-primary w-full" disabled={createCustomer.isPending}>
              {createCustomer.isPending ? 'Adding...' : 'Add Customer'}
            </button>
          </form>
        </div>

        <div className="card md:col-span-2">
          <h3 className="font-semibold mb-3 text-sm">All Customers</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-100">
                <th className="pb-2">Name</th>
                <th className="pb-2">Contact</th>
                <th className="pb-2">Address</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-b border-slate-50">
                  <td className="py-2 font-medium">{c.name}</td>
                  <td className="py-2 text-slate-500">{c.contact_number || '—'}</td>
                  <td className="py-2 text-slate-500">{c.address || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}