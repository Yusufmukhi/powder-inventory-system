import { useActivityLog } from '../hooks/queries'
import { ActivityLogEntry } from '../types'

const ACTION_LABELS: Record<string, string> = {
  'user.created': 'Account created',
  'user.removed': 'Account removed',
  'user.password_reset': 'Password reset (by Owner)',
  'user.password_changed': 'Password changed (self)',
  'job.edited': 'Job edited',
  'job.approved': 'Job approved',
  'job.payment_updated': 'Job payment updated',
  'expense.deleted': 'Expense deleted',
  'asset.deleted': 'Asset deleted',
  'company.created': 'Company created',
  'company.updated': 'Company settings updated',
  'company.suspended': 'Company suspended',
  'company.reactivated': 'Company reactivated',
}

function describe(entry: ActivityLogEntry): string {
  const d = entry.details || {}
  const who = d.username || d.email || 'unknown'
  switch (entry.action) {
    case 'user.created':
      return `Created ${who} as ${String(d.role || '').replace('_', ' ')}`
    case 'user.removed':
      return `Removed ${who}`
    case 'user.password_reset':
      return `Reset the password for ${who}`
    case 'user.password_changed':
      return `Changed their own password`
    case 'job.edited':
      return `Edited job ${d.job_number} (${(d.fields || []).join(', ')})`
    case 'job.approved':
      return `Approved job ${d.job_number} — ₹${d.price_charged} charged, ₹${d.powder_cost} powder cost`
    case 'job.payment_updated':
      return `Updated payment on job ${d.job_number} to ${d.payment_status}`
    case 'expense.deleted':
      return `Deleted a ${d.category} expense of ₹${d.amount} (${d.expense_date})`
    case 'asset.deleted':
      return `Deleted asset "${d.name}" (₹${d.purchase_price})`
    case 'company.created':
      return `Created company "${d.name}" with owner ${d.owner_email}`
    case 'company.suspended':
      return `Suspended this company`
    case 'company.reactivated':
      return `Reactivated this company`
    case 'company.updated':
      return `Updated: ${Object.keys(d).join(', ')}`
    default:
      return entry.action
  }
}

export default function ActivityLog() {
  const { data: entries, isLoading, error } = useActivityLog()
  const entryList = entries as ActivityLogEntry[] | undefined

  if (error) return <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">Could not load activity log</div>
  if (isLoading || !entryList) return <p className="text-slate-400 text-sm">Loading...</p>
  if (entryList.length === 0) {
    return (
      <div className="card">
        <p className="text-sm text-slate-500">
          Nothing recorded yet. Every account change, job approval, payment update, and deletion
          from here on will show up in this log.
        </p>
      </div>
    )
  }

  return (
    <div className="card overflow-x-auto">
      <h3 className="font-semibold mb-3 text-sm">Activity Log</h3>
      <p className="text-xs text-slate-400 mb-4">
        A read-only record of who did what, most recent first. Nothing here can be edited or deleted.
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-400 border-b border-slate-100">
            <th className="pb-2">When</th>
            <th className="pb-2">Username</th>
            <th className="pb-2">Action</th>
            <th className="pb-2">Details</th>
          </tr>
        </thead>
        <tbody>
          {entryList.map((e) => (
            <tr key={e.id} className="border-b border-slate-50 align-top">
              <td className="py-2 whitespace-nowrap text-slate-500">
                {new Date(e.created_at).toLocaleString('en-IN')}
              </td>
              <td className="py-2 whitespace-nowrap">{e.actor_username || e.actor_email}</td>
              <td className="py-2 whitespace-nowrap">{ACTION_LABELS[e.action] || e.action}</td>
              <td className="py-2 text-slate-500">{describe(e)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}