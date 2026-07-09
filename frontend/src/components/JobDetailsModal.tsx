import { useEffect, useState } from 'react'
import api from '../api/client'
import { Job, PaymentEntry } from '../types'

interface Props {
  job: Job
  onClose: () => void
  onUpdatePayment: () => void
}

const statusLabels: Record<string, string> = {
  received: 'Received',
  in_process: 'In Progress',
  approved: 'Approved',
  delivered: 'Delivered',
}

const statusColors: Record<string, string> = {
  received: 'bg-slate-100 text-slate-600',
  in_process: 'bg-amber-100 text-amber-700',
  approved: 'bg-blue-100 text-blue-700',
  delivered: 'bg-green-100 text-green-700',
}

const paymentColors: Record<string, string> = {
  unpaid: 'bg-red-100 text-red-600',
  advance: 'bg-amber-100 text-amber-700',
  paid: 'bg-green-100 text-green-700',
}

const methodLabels: Record<string, string> = {
  cash: 'Cash',
  cheque: 'Cheque',
  upi: 'UPI/QR',
  bank_transfer: 'Bank Transfer',
  card: 'Card',
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between py-1.5 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium text-slate-700 text-right">{value ?? '—'}</span>
    </div>
  )
}

export default function JobDetailsModal({ job, onClose, onUpdatePayment }: Props) {
  const total = job.price_charged ?? 0
  const advance = job.advance_amount ?? 0
  const balance = Math.max(total - advance, 0)
  const [payments, setPayments] = useState<PaymentEntry[]>([])

  useEffect(() => {
    api.get(`/jobs/${job.id}/payments`).then((res) => setPayments(res.data)).catch(() => setPayments([]))
  }, [job.id])

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-1">
          <h3 className="text-lg font-semibold">{job.job_number}</h3>
          <span className={`badge ${statusColors[job.status]}`}>{statusLabels[job.status]}</span>
        </div>
        <p className="text-sm text-slate-400 mb-4">{job.customer_name}</p>

        {/* Job info */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Job</p>
          <Row label="Product" value={job.product_name} />
          <Row label="Qty Received" value={job.qty_received} />
          <Row label="Powder / Shade" value={job.shade_name} />
          <Row label="Date Received" value={new Date(job.date_received).toLocaleDateString('en-IN')} />
          <Row
            label="Promised By"
            value={
              <>
                {new Date(job.date_promised).toLocaleDateString('en-IN')}
                {job.was_late && <span className="ml-1 text-xs text-red-500">(late)</span>}
              </>
            }
          />
          {job.date_completed && (
            <Row label="Completed" value={new Date(job.date_completed).toLocaleDateString('en-IN')} />
          )}
          {job.notes && <Row label="Notes" value={job.notes} />}
        </div>

        {/* Powder usage — only present once approved */}
        {(job.powder_consumed_kg !== undefined && job.powder_consumed_kg !== null) && (
          <div className="mb-4 pt-3 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Powder Used</p>
            <Row label="Powder Consumed" value={`${job.powder_consumed_kg} kg`} />
            <Row label="Powder Cost" value={job.powder_cost != null ? `₹${job.powder_cost.toLocaleString('en-IN')}` : '—'} />
          </div>
        )}

        {/* Payment breakdown */}
        <div className="mb-2 pt-3 border-t border-slate-100">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Payment</p>
          <Row
            label="Status"
            value={
              <span className={`badge ${paymentColors[job.payment_status]}`}>
                {job.payment_status}{job.payment_method ? ` · ${methodLabels[job.payment_method]}` : ''}
              </span>
            }
          />
          <Row label="Total Job Value" value={job.price_charged != null ? `₹${total.toLocaleString('en-IN')}` : 'Not set yet (approve job first)'} />
          {job.price_charged != null && (
            <>
              <Row label="Advance Received" value={`₹${advance.toLocaleString('en-IN')}`} />
              <div className="flex justify-between py-1.5 text-sm border-t border-slate-100 mt-1 pt-2">
                <span className="font-semibold text-slate-600">Balance Due</span>
                <span className={`font-semibold ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  ₹{balance.toLocaleString('en-IN')}
                </span>
              </div>
            </>
          )}

          {payments.length > 0 && (
            <div className="mt-3 pt-2 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Payment History</p>
              {payments.map((p) => (
                <div key={p.id} className="flex justify-between text-xs py-1 text-slate-500">
                  <span>{new Date(p.paid_date).toLocaleDateString('en-IN')} · {p.payment_method.replace('_', ' ')}</span>
                  <span className="font-medium text-slate-700">₹{p.amount.toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end mt-5">
          <button className="btn-secondary" onClick={onClose}>Close</button>
          {job.price_charged != null && (
            <button className="btn-primary" onClick={onUpdatePayment}>Add Payment</button>
          )}
        </div>
      </div>
    </div>
  )
}