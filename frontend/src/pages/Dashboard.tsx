import { useDashboardSummary } from '../hooks/queries'

export default function Dashboard() {
  const { data: summary, isLoading } = useDashboardSummary()

  if (isLoading || !summary) return <p className="text-slate-400 text-sm">Loading...</p>

  const stats = [
    { label: 'Total Jobs', value: summary.total_jobs },
    { label: 'Pending Jobs', value: summary.pending_jobs },
    { label: 'Late Jobs', value: summary.late_jobs, warn: summary.late_jobs > 0 },
    { label: 'Outstanding Receivables', value: `₹${summary.outstanding_receivables.toLocaleString('en-IN')}` },
  ]

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6">Dashboard</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="card">
            <p className="text-xs text-slate-400 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.warn ? 'text-red-500' : 'text-slate-800'}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="card">
        <h3 className="font-semibold mb-3 text-sm">Low Stock Powders</h3>
        {summary.low_stock_powders.length === 0 ? (
          <p className="text-sm text-slate-400">All powder shades are above reorder threshold.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {summary.low_stock_powders.map((p) => (
              <li key={p.id} className="py-2 flex justify-between text-sm">
                <span>{p.shade_name}</span>
                <span className="text-red-500 font-medium">{p.stock_kg}kg left</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}