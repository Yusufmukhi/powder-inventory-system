import { useEffect, useState } from 'react'

interface Column {
  key: string
  label: string
  render?: (row: any) => React.ReactNode
}

interface Props {
  columns: Column[]
  data: any[]
  pageSize?: number
  height?: string
  loading?: boolean
  emptyText?: string
}

export default function DataTable({
  columns,
  data,
  pageSize = 10,
  height,
  loading = false,
  emptyText = 'No data for this range.',
}: Props) {
  const [page, setPage] = useState(0)

  // Reset to page 1 whenever the underlying data changes (new date range,
  // new tab, new powder) so we never get stuck on an out-of-range page.
  useEffect(() => setPage(0), [data])

  const totalPages = Math.max(1, Math.ceil(data.length / pageSize))
  const start = page * pageSize
  const pageRows = data.slice(start, start + pageSize)

  return (
    <div>
      <div className={`overflow-y-auto ${height || ''} scrollbar-thin`}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white">
            <tr className="text-left text-slate-400 border-b border-slate-100">
              {columns.map((c) => (
                <th key={c.key} className="pb-2 pr-3">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={columns.length} className="py-6 text-center text-slate-400">Loading...</td></tr>
            ) : pageRows.length === 0 ? (
              <tr><td colSpan={columns.length} className="py-6 text-center text-slate-400">{emptyText}</td></tr>
            ) : (
              pageRows.map((row, i) => (
                <tr key={row.id ?? start + i} className="border-b border-slate-50">
                  {columns.map((c) => (
                    <td key={c.key} className="py-2 pr-3">
                      {c.render ? c.render(row) : (row[c.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && data.length > pageSize && (
        <div className="flex justify-between items-center mt-2 text-xs text-slate-500">
          <span>
            Showing {start + 1}-{Math.min(start + pageSize, data.length)} of {data.length}
          </span>
          <div className="flex gap-2 items-center">
            <button
              className="px-2 py-1 rounded border border-slate-200 disabled:opacity-40"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Prev
            </button>
            <span>{page + 1} / {totalPages}</span>
            <button
              className="px-2 py-1 rounded border border-slate-200 disabled:opacity-40"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
