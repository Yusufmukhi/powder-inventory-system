import { useState } from 'react'
import api from '../api/client'
import { Customer, Powder } from '../types'

interface Props {
  customers: Customer[]
  powders: Powder[]
  onDone: () => void
  onCancel: () => void
  editingJob?: any
}

export default function JobForm({ customers, powders, onDone, onCancel, editingJob }: Props) {
  const [form, setForm] = useState({
    customer_id: editingJob?.customer_id || '',
    product_name: editingJob?.product_name || '',
    qty_received: editingJob?.qty_received || '',
    powder_id: editingJob?.powder_id || '',
    date_received: editingJob?.date_received || new Date().toISOString().slice(0, 10),
    date_promised: editingJob?.date_promised || '',
    notes: editingJob?.notes || '',
  })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = { ...form, qty_received: parseInt(form.qty_received) }
    if (editingJob) {
      await api.patch(`/jobs/${editingJob.id}`, payload)
    } else {
      await api.post('/jobs/', payload)
    }
    onDone()
  }

  return (
    <form onSubmit={submit} className="card grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
      <div>
        <label className="label">Customer</label>
        <select className="input" required value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
          <option value="">Select customer</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Product</label>
        <input className="input" required value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} placeholder="e.g. Mobile Compactor Rack" />
      </div>
      <div>
        <label className="label">Qty Received</label>
        <input type="number" className="input" required value={form.qty_received} onChange={(e) => setForm({ ...form, qty_received: e.target.value })} />
      </div>
      <div>
        <label className="label">Color / Powder</label>
        <select className="input" required value={form.powder_id} onChange={(e) => setForm({ ...form, powder_id: e.target.value })}>
          <option value="">Select powder</option>
          {powders.map((p) => <option key={p.id} value={p.id}>{p.shade_name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Date Received</label>
        <input type="date" className="input" required value={form.date_received} onChange={(e) => setForm({ ...form, date_received: e.target.value })} />
      </div>
      <div>
        <label className="label">Date Needed By</label>
        <input type="date" className="input" required value={form.date_promised} onChange={(e) => setForm({ ...form, date_promised: e.target.value })} />
      </div>
      <div className="col-span-2 md:col-span-3">
        <label className="label">Notes</label>
        <input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </div>
      <div className="col-span-2 md:col-span-3 flex gap-2">
        <button className="btn-primary">{editingJob ? 'Save Changes' : 'Create Job'}</button>
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
