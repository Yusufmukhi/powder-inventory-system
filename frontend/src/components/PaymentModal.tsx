import { useState } from 'react'
import api from '../api/client'
import { Job, PaymentMethod } from '../types'

interface Props {
  job: Job
  onDone: () => void
  onCancel: () => void
}

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'upi', label: 'UPI / QR' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'card', label: 'Card' },
]

export default function PaymentModal({ job, onDone, onCancel }: Props) {
  const total = job.price_charged ?? 0
  const alreadyPaid = job.advance_amount ?? 0
  const balanceDue = Math.max(total - alreadyPaid, 0)

  const [amount, setAmount] = useState(balanceDue > 0 ? String(balanceDue) : '')
  const [method, setMethod] = useState<PaymentMethod | ''>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const numericAmount = parseFloat(amount || '0')
  const canSave = numericAmount > 0 && !!method

  const save = async () => {
    if (!canSave) return
    setSaving(true)
    setError('')
    try {
      await api.post(`/jobs/${job.id}/payments`, {
        amount: numericAmount,
        payment_method: method,
      })
      onDone()
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Could not save payment. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg max-w-sm w-full p-6">
        <h3 className="text-lg font-semibold mb-1">Add Payment</h3>
        <p className="text-sm text-slate-400 mb-4">{job.job_number} — {job.customer_name}</p>

        {job.price_charged != null ? (
          <div className="bg-slate-50 rounded-lg p-3 mb-4 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">Total Job Value</span><span>₹{total.toLocaleString('en-IN')}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Already Received</span><span>₹{alreadyPaid.toLocaleString('en-IN')}</span></div>
            <div className="flex justify-between font-semibold border-t border-slate-200 pt-1 mt-1">
              <span>Balance Due</span>
              <span className={balanceDue > 0 ? 'text-red-600' : 'text-green-600'}>₹{balanceDue.toLocaleString('en-IN')}</span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-3 mb-4">
            This job hasn't been approved yet, so there's no total job value set. You can still log a payment (e.g. an advance) — it'll be counted once the job is approved.
          </p>
        )}

        <label className="label">Amount Received Now (₹)</label>
        <input
          type="number"
          className="input mb-4"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="e.g. 500"
          autoFocus
        />

        <label className="label">Payment Method</label>
        <div className="grid grid-cols-2 gap-2 mb-2">
          {METHODS.map((m) => (
            <button
              key={m.value}
              className={`py-2 rounded-lg text-sm font-medium border ${method === m.value ? 'bg-brand-50 border-brand-500 text-brand-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              onClick={() => setMethod(m.value)}
            >
              {m.label}
            </button>
          ))}
        </div>
        {!method && <p className="text-xs text-red-500 mb-2">Select how the payment was made.</p>}
        {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

        <div className="flex gap-2 justify-end mt-4">
          <button className="btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn-primary" disabled={!canSave || saving} onClick={save}>
            {saving ? 'Saving...' : 'Save Payment'}
          </button>
        </div>
      </div>
    </div>
  )
}