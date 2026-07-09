import { useEffect, useState } from 'react'
import api from '../api/client'
import { Powder, StockMovement } from '../types'

interface Props {
  powder: Powder
  onClose: () => void
}

const RANGES = [
  { label: '1 week', days: 7 },
  { label: '1 month', days: 30 },
  { label: '3 months', days: 90 },
  { label: 'All time', days: 3650 },
]

export default function StockMovementsModal({ powder, onClose }: Props) {
  const [days, setDays] = useState(30)
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get(`/powders/${powder.id}/movements`, { params: { days } })
      .then((res) => setMovements(res.data))
      .finally(() => setLoading(false))
  }, [powder.id, days])

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg max-w-xl w-full max-h-[85vh] flex flex-col">
        {/* Header — fixed, doesn't scroll */}
        <div className="flex justify-between items-start p-6 pb-1 shrink-0">
          <div>
            <h3 className="text-lg font-semibold">{powder.shade_name}</h3>
            <p className="text-sm text-slate-400">Current stock: {powder.stock_kg}kg</p>
          </div>
          <button className="text-slate-400 hover:text-slate-600 text-sm" onClick={onClose}>Close</button>
        </div>

        <div className="flex justify-between items-center px-6 pt-3 pb-1 shrink-0">
          <div className="flex gap-2">
            {RANGES.map((r) => (
              <button
                key={r.days}
                className={`px-3 py-1 rounded-full text-xs font-medium ${days === r.days ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600'}`}
                onClick={() => setDays(r.days)}
              >
                {r.label}
              </button>
            ))}
          </div>
          {!loading && movements.length > 0 && (
            <span className="text-xs text-slate-400">{movements.length} entries</span>
          )}
        </div>

        {/* Body — the part that actually scrolls, with a visible scrollbar */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 mt-2 scrollbar-thin">
          {loading ? (
            <p className="text-sm text-slate-400 py-4">Loading...</p>
          ) : movements.length === 0 ? (
            <p className="text-sm text-slate-400 py-4">No stock activity in this period.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Type</th>
                  <th className="pb-2">Qty (kg)</th>
                  <th className="pb-2">Price/kg</th>
                  <th className="pb-2">Details</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td className="py-2 text-slate-500 whitespace-nowrap">{new Date(m.date).toLocaleDateString('en-IN')}</td>
                    <td className="py-2">
                      <span className={`badge ${m.type === 'added' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {m.type === 'added' ? 'Added' : 'Used'}
                      </span>
                    </td>
                    <td className="py-2">{m.qty_kg}</td>
                    <td className="py-2 text-slate-500">₹{m.price_per_kg}</td>
                    <td className="py-2 text-slate-500">
                      {m.type === 'added' ? m.supplier_name : m.job_number ? `Job ${m.job_number}` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
