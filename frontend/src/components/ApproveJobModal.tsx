import { useState } from 'react'
import api from '../api/client'
import { Job, Powder } from '../types'

interface Props {
  job: Job
  powder?: Powder
  onDone: () => void
  onCancel: () => void
}

export default function ApproveJobModal({ job, powder, onDone, onCancel }: Props) {
  const [form, setForm] = useState({
    date_completed: new Date().toISOString().slice(0, 10),
    powder_consumed_kg: '',
    price_charged: '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await api.post(`/jobs/${job.id}/approve`, {
        date_completed: form.date_completed,
        powder_consumed_kg: parseFloat(form.powder_consumed_kg),
        price_charged: parseFloat(form.price_charged),
      })
      onDone()
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Could not approve job')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
        <h3 className="text-lg font-semibold mb-1">Approve Job — {job.job_number}</h3>
        <p className="text-sm text-slate-400 mb-4">{job.product_name} · {job.customer_name} · {job.shade_name}</p>

        {powder && (
          <p className="text-xs text-slate-400 mb-4">Available stock: {powder.stock_kg}kg</p>
        )}

        {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">{error}</div>}

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="label">Completion Date</label>
            <input type="date" className="input" required value={form.date_completed} onChange={(e) => setForm({ ...form, date_completed: e.target.value })} />
          </div>
          <div>
            <label className="label">Powder Consumed (kg)</label>
            <input type="number" step="0.01" className="input" required value={form.powder_consumed_kg} onChange={(e) => setForm({ ...form, powder_consumed_kg: e.target.value })} />
          </div>
          <div>
            <label className="label">Price Worked For (₹)</label>
            <input type="number" step="0.01" className="input" required value={form.price_charged} onChange={(e) => setForm({ ...form, price_charged: e.target.value })} />
          </div>
          <div className="flex gap-2 pt-2">
            <button className="btn-primary" disabled={saving}>{saving ? 'Approving...' : 'Confirm Approve'}</button>
            <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}
