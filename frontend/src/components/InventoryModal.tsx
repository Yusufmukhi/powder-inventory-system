import DataTable from './DataTable'

interface Props {
  open: boolean
  powder: string | null
  fromDate: string
  toDate: string
  activeTab: 'usage' | 'stock'
  usageRows: any[]
  stockRows: any[]
  loading?: boolean
  onClose: () => void
  onFromChange: (v: string) => void
  onToChange: (v: string) => void
  onTabChange: (v: 'usage' | 'stock') => void
}

export default function InventoryModal({
  open,
  powder,
  fromDate,
  toDate,
  activeTab,
  usageRows,
  stockRows,
  loading = false,
  onClose,
  onFromChange,
  onToChange,
  onTabChange,
}: Props) {
  if (!open || !powder) return null

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white w-[95%] max-w-5xl rounded-lg shadow-lg p-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-lg">Powder: {powder}</h3>
          <button className="text-red-600 text-sm" onClick={onClose}>Close</button>
        </div>

        {/* DATE FILTER — changing either date re-fetches only that range from
            the server, so the modal never has to pull the powder's full history. */}
        <div className="flex gap-4 mb-4">
          <div>
            <label className="text-xs text-gray-500">From</label>
            <input
              type="date"
              value={fromDate}
              max={toDate}
              onChange={(e) => onFromChange(e.target.value)}
              className="border p-1 rounded block"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">To</label>
            <input
              type="date"
              value={toDate}
              min={fromDate}
              onChange={(e) => onToChange(e.target.value)}
              className="border p-1 rounded block"
            />
          </div>
        </div>

        {/* TABS — only the active tab's data is fetched/shown */}
        <div className="flex gap-6 border-b mb-4">
          <button
            onClick={() => onTabChange('usage')}
            className={`pb-2 ${activeTab === 'usage' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
          >
            Usage
          </button>
          <button
            onClick={() => onTabChange('stock')}
            className={`pb-2 ${activeTab === 'stock' ? 'border-b-2 border-green-600 text-green-600' : 'text-gray-500'}`}
          >
            Add Stock
          </button>
        </div>

        {/* TABLES */}
        {activeTab === 'usage' && (
          <DataTable
            columns={[
              { key: 'date', label: 'Date', render: (r) => new Date(r.date).toLocaleDateString('en-IN') },
              { key: 'supplier', label: 'Job #' },
              { key: 'client', label: 'Client' },
              { key: 'qty', label: 'Qty (kg)' },
              { key: 'cost', label: 'Cost (₹)', render: (r) => `₹${Number(r.cost).toLocaleString('en-IN')}` },
            ]}
            data={usageRows}
            pageSize={5}
            height="h-64"
            loading={loading}
            emptyText="No usage in this period."
          />
        )}
        {activeTab === 'stock' && (
          <DataTable
            columns={[
              { key: 'date', label: 'Date', render: (r) => new Date(r.date).toLocaleDateString('en-IN') },
              { key: 'supplier', label: 'Supplier' },
              { key: 'qty', label: 'Qty (kg)' },
              { key: 'rate', label: 'Rate (₹)', render: (r) => `₹${r.rate}` },
              { key: 'value', label: 'Value (₹)', render: (r) => `₹${Number(r.value).toLocaleString('en-IN')}` },
            ]}
            data={stockRows}
            pageSize={5}
            height="h-64"
            loading={loading}
            emptyText="No stock added in this period."
          />
        )}
      </div>
    </div>
  )
}
