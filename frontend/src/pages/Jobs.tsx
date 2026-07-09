import { useMemo, useState } from 'react'
import { Customer, Job, Powder } from '../types'
import JobForm from '../components/JobForm'
import ApproveJobModal from '../components/ApproveJobModal'
import PaymentModal from '../components/PaymentModal'
import { useAuth } from '../context/AuthContext'
import JobDetailsModal from '../components/JobDetailsModal'
import {
  useJobs, useCustomers, usePowders, useMarkJobDelivered, useStartJob, useInvalidateJobsRelated,
} from '../hooks/queries'

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

const EDITABLE = ['received', 'in_process']

type QuickFilter = 'all' | 'pending' | 'approved' | 'delivered' | 'unpaid' | 'late'

const FILTERS: { key: QuickFilter; label: string }[] = [
  { key: 'all', label: 'All Jobs' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'unpaid', label: 'Unpaid' },
  { key: 'late', label: 'Late' },
]

export default function Jobs() {
  const { role } = useAuth()
  const { data: jobs = [] } = useJobs()
  const { data: customers = [] } = useCustomers()
  const { data: powders = [] } = usePowders()
  const markDeliveredMutation = useMarkJobDelivered()
  const startJobMutation = useStartJob()
  const invalidateJobsRelated = useInvalidateJobsRelated()

  const [showForm, setShowForm] = useState(false)
  const [editingJob, setEditingJob] = useState<any>(null)
  const [approvingJob, setApprovingJob] = useState<Job | null>(null)
  const [payingJob, setPayingJob] = useState<Job | null>(null)

  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all')
  const [customerFilter, setCustomerFilter] = useState('')
  const [groupByClient, setGroupByClient] = useState(false)
  const [viewingJob, setViewingJob] = useState<Job | null>(null)

  const startEdit = (job: Job) => {
    setEditingJob(job)
    setShowForm(true)
  }

  const markDelivered = (job: Job) => markDeliveredMutation.mutate(job.id)
  const startJob = (job: Job) => startJobMutation.mutate(job.id)

  // ---- Filtering ----
  const filteredJobs = useMemo(() => {
    let list: Job[] = jobs
    if (customerFilter) list = list.filter((j) => j.customer_id === customerFilter)
    switch (quickFilter) {
      case 'pending': list = list.filter((j) => EDITABLE.includes(j.status)); break
      case 'approved': list = list.filter((j) => j.status === 'approved'); break
      case 'delivered': list = list.filter((j) => j.status === 'delivered'); break
      case 'unpaid': list = list.filter((j) => j.payment_status !== 'paid'); break
      case 'late': list = list.filter((j) => j.was_late); break
    }
    return list
  }, [jobs, quickFilter, customerFilter])

  const counts = useMemo(() => ({
    all: jobs.length,
    pending: jobs.filter((j: Job) => EDITABLE.includes(j.status)).length,
    approved: jobs.filter((j: Job) => j.status === 'approved').length,
    delivered: jobs.filter((j: Job) => j.status === 'delivered').length,
    unpaid: jobs.filter((j: Job) => j.payment_status !== 'paid').length,
    late: jobs.filter((j: Job) => j.was_late).length,
  }), [jobs])

  // ---- Grouping by client ----
  const grouped = useMemo(() => {
    if (!groupByClient) return null
    const map = new Map<string, Job[]>()
    for (const j of filteredJobs) {
      const key = j.customer_name || 'Unknown'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(j)
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [filteredJobs, groupByClient])

  const renderRow = (j: Job) => (
  <tr
    key={j.id}
    className="border-b border-slate-50 cursor-pointer hover:bg-slate-50"
    onClick={() => setViewingJob(j)}
  >
    <td className="py-2 font-medium">{j.job_number}</td>
    {!groupByClient && <td className="py-2">{j.customer_name}</td>}
    <td className="py-2">{j.product_name}</td>
    <td className="py-2">{j.qty_received}</td>
    <td className="py-2">{j.shade_name}</td>
    <td className="py-2">
      {new Date(j.date_promised).toLocaleDateString('en-IN')}
      {j.was_late && <span className="ml-1 text-xs text-red-500">(late)</span>}
    </td>
    <td className="py-2">
      <span className={`badge ${statusColors[j.status]}`}>{j.status.replace('_', ' ')}</span>
    </td>
    <td className="py-2">
      {j.status === 'delivered' && j.payment_status === 'paid' ? (
        <span className="badge bg-green-100 text-green-700">Completed</span>
      ) : (
        <button className={`badge ${paymentColors[j.payment_status]}`} onClick={(e) => { e.stopPropagation(); setPayingJob(j) }} title="Click to update payment">
          {j.payment_status}{j.payment_method ? ` · ${methodLabels[j.payment_method]}` : ''}
        </button>
      )}
    </td>
    <td className="py-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
      {EDITABLE.includes(j.status) && (
        <>
          {j.status === 'received' && (
            <button className="text-amber-600 text-xs font-medium hover:underline mr-3" onClick={() => startJob(j)}>Start</button>
          )}
          <button className="text-brand-500 text-xs font-medium hover:underline mr-3" onClick={() => startEdit(j)}>Edit</button>
          {role === 'owner' && (
            <button className="text-green-600 text-xs font-medium hover:underline" onClick={() => setApprovingJob(j)}>Approve</button>
          )}
        </>
      )}
      {j.status === 'approved' && (
        <button className="text-blue-600 text-xs font-medium hover:underline" onClick={() => markDelivered(j)}>Mark Delivered</button>
      )}
    </td>
  </tr>
)

  const colCount = groupByClient ? 8 : 9

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Jobs</h2>
        <button className="btn-primary" onClick={() => { setEditingJob(null); setShowForm(!showForm) }}>
          {showForm ? 'Cancel' : '+ New Job'}
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 items-center justify-between mb-6">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setQuickFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                quickFilter === f.key
                  ? 'bg-brand-500 text-white border-brand-500'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {f.label} <span className="opacity-70">({counts[f.key]})</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          <select className="input w-auto" value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)}>
            <option value="">All customers</option>
            {customers.map((c: Customer) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-slate-500 font-medium cursor-pointer select-none">
            <input type="checkbox" checked={groupByClient} onChange={(e) => setGroupByClient(e.target.checked)} />
            Group by client
          </label>
        </div>
      </div>

      {showForm && (
        <JobForm
          customers={customers}
          powders={powders}
          editingJob={editingJob}
          onDone={() => { setShowForm(false); setEditingJob(null); invalidateJobsRelated() }}
          onCancel={() => { setShowForm(false); setEditingJob(null) }}
        />
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-100">
              <th className="pb-2">Job #</th>
              {!groupByClient && <th className="pb-2">Customer</th>}
              <th className="pb-2">Product</th>
              <th className="pb-2">Qty</th>
              <th className="pb-2">Color</th>
              <th className="pb-2">Needed By</th>
              <th className="pb-2">Status</th>
              <th className="pb-2">Payment</th>
              <th className="pb-2"></th>
            </tr>
          </thead>
          {!groupByClient ? (
            <tbody>
              {filteredJobs.map(renderRow)}
              {filteredJobs.length === 0 && (
                <tr><td colSpan={colCount} className="py-6 text-center text-slate-400">No jobs match this filter.</td></tr>
              )}
            </tbody>
          ) : (
            grouped!.map(([customerName, list]) => (
              <tbody key={customerName}>
                <tr className="bg-slate-50">
                  <td colSpan={colCount} className="py-2 px-1 font-semibold text-slate-600">
                    {customerName} <span className="text-slate-400 font-normal">({list.length} job{list.length !== 1 ? 's' : ''})</span>
                  </td>
                </tr>
                {list.map(renderRow)}
              </tbody>
            ))
          )}
          {groupByClient && grouped!.length === 0 && (
            <tbody><tr><td colSpan={colCount} className="py-6 text-center text-slate-400">No jobs match this filter.</td></tr></tbody>
          )}
        </table>
      </div>

      {approvingJob && (
        <ApproveJobModal
          job={approvingJob}
          powder={powders.find((p: Powder) => p.id === approvingJob.powder_id)}
          onDone={() => { setApprovingJob(null); invalidateJobsRelated() }}
          onCancel={() => setApprovingJob(null)}
        />
      )}

      {payingJob && (
        <PaymentModal
          job={payingJob}
          onDone={() => { setPayingJob(null); invalidateJobsRelated() }}
          onCancel={() => setPayingJob(null)}
        />
      )}
      {viewingJob && (
  <JobDetailsModal
    job={jobs.find((j: Job) => j.id === viewingJob.id) || viewingJob}
    onClose={() => setViewingJob(null)}
    onUpdatePayment={() => { setPayingJob(viewingJob); setViewingJob(null) }}
  />
)}
    </div>
  )
}