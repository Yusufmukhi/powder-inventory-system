import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { usePowders, useSuppliers, useCreatePowder, useAddStock, usePowderUsage, usePowderStock, queryKeys } from '../hooks/queries'
import { Powder } from '../types'
import SupplierSelect from '../components/SupplierSelect'
import InventoryModal from '../components/InventoryModal'

const todayStr = () => new Date().toISOString().slice(0, 10)
const daysAgoStr = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)

export default function PowderInventory() {
  const { data: powders = [] } = usePowders()
  const { data: suppliers = [] } = useSuppliers()
  const createPowder = useCreatePowder()
  const addStock = useAddStock()
  const qc = useQueryClient()

  const [showNewPowder, setShowNewPowder] = useState(false)
  const [selectedPowder, setSelectedPowder] = useState<Powder | null>(null)
  const [activeTab, setActiveTab] = useState<'usage' | 'stock'>('usage')
  const [fromDate, setFromDate] = useState(daysAgoStr(30))
  const [toDate, setToDate] = useState(todayStr())

  const openPowder = (p: Powder) => {
    setSelectedPowder(p)
    setActiveTab('usage')
    setFromDate(daysAgoStr(30))
    setToDate(todayStr())
  }

  // Only the active tab's query is enabled, and only once a powder is
  // selected — so clicking a row (or switching dates/tabs) fetches exactly
  // the rows that tab needs, not the powder's entire history.
  const { data: usageRows = [], isFetching: usageLoading } = usePowderUsage(
    selectedPowder?.id ?? null, fromDate, toDate, !!selectedPowder && activeTab === 'usage'
  )
  const { data: stockRows = [], isFetching: stockLoading } = usePowderStock(
    selectedPowder?.id ?? null, fromDate, toDate, !!selectedPowder && activeTab === 'stock'
  )

  const [newPowder, setNewPowder] = useState({ shade_name: '', default_supplier_id: '' })
  const [stockForm, setStockForm] = useState({
    powder_id: '', supplier_id: '', price_per_kg: '', qty_kg: '', purchase_date: new Date().toISOString().slice(0, 10),
  })

  const addPowder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPowder.shade_name.trim()) return
    await createPowder.mutateAsync({
      shade_name: newPowder.shade_name.trim(),
      default_supplier_id: newPowder.default_supplier_id || null,
    })
    setNewPowder({ shade_name: '', default_supplier_id: '' })
    setShowNewPowder(false)
  }

  const addStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stockForm.powder_id || !stockForm.supplier_id || !stockForm.price_per_kg || !stockForm.qty_kg) return
    await addStock.mutateAsync({
      ...stockForm,
      price_per_kg: parseFloat(stockForm.price_per_kg),
      qty_kg: parseFloat(stockForm.qty_kg),
    })
    setStockForm({ powder_id: '', supplier_id: '', price_per_kg: '', qty_kg: '', purchase_date: new Date().toISOString().slice(0, 10) })
  }

  // SupplierSelect creates a supplier inline and hands back the new row —
  // no dedicated hook needed here, just refresh the suppliers list.
  const onSupplierCreated = () => qc.invalidateQueries({ queryKey: queryKeys.suppliers })

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Powder Inventory</h2>
        <button className="btn-primary" onClick={() => setShowNewPowder(!showNewPowder)}>
          {showNewPowder ? 'Cancel' : '+ New Powder'}
        </button>
      </div>

      {showNewPowder && (
        <form onSubmit={addPowder} className="card mb-6 grid grid-cols-2 gap-3">
          <div>
            <label className="label">Powder Name / Color</label>
            <input className="input" required value={newPowder.shade_name} onChange={(e) => setNewPowder({ ...newPowder, shade_name: e.target.value })} placeholder="e.g. Jet Black" />
          </div>
          <div>
            <label className="label">Supplier</label>
            <SupplierSelect
              suppliers={suppliers}
              value={newPowder.default_supplier_id}
              onChange={(id) => setNewPowder({ ...newPowder, default_supplier_id: id })}
              onCreated={onSupplierCreated}
            />
          </div>
          <div className="col-span-2">
            <button className="btn-primary" disabled={createPowder.isPending}>
              {createPowder.isPending ? 'Saving...' : 'Save Powder'}
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card overflow-x-auto">
          <h3 className="font-semibold mb-3 text-sm">Stock by Powder <span className="text-slate-400 font-normal">(click a row for history)</span></h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-100">
                <th className="pb-2">Powder</th>
                <th className="pb-2">Stock</th>
              </tr>
            </thead>
            <tbody>
              {powders.map((p) => (
                <tr key={p.id} className="border-b border-slate-50 cursor-pointer hover:bg-slate-50" onClick={() => openPowder(p)}>
                  <td className="py-2 font-medium">{p.shade_name}</td>
                  <td className="py-2">
                    <span className={`badge ${p.low_stock ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                      {p.stock_kg}kg
                    </span>
                  </td>
                </tr>
              ))}
              {powders.length === 0 && (
                <tr><td colSpan={2} className="py-6 text-center text-slate-400">No powders added yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card h-fit">
          <h3 className="font-semibold mb-3 text-sm">Add Stock</h3>
          <form onSubmit={addStockSubmit} className="space-y-3">
            <div>
              <label className="label">Powder / Color</label>
              <select className="input" required value={stockForm.powder_id} onChange={(e) => setStockForm({ ...stockForm, powder_id: e.target.value })}>
                <option value="">Select powder</option>
                {powders.map((p) => <option key={p.id} value={p.id}>{p.shade_name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Supplier</label>
              <SupplierSelect
                suppliers={suppliers}
                value={stockForm.supplier_id}
                onChange={(id) => setStockForm({ ...stockForm, supplier_id: id })}
                onCreated={onSupplierCreated}
                required
              />
            </div>
            <div>
              <label className="label">Price per kg (₹)</label>
              <input type="number" step="0.01" className="input" required value={stockForm.price_per_kg} onChange={(e) => setStockForm({ ...stockForm, price_per_kg: e.target.value })} />
            </div>
            <div>
              <label className="label">Qty (kg)</label>
              <input type="number" step="0.1" className="input" required value={stockForm.qty_kg} onChange={(e) => setStockForm({ ...stockForm, qty_kg: e.target.value })} />
            </div>
            <div>
              <label className="label">Purchase Date</label>
              <input type="date" className="input" required value={stockForm.purchase_date} onChange={(e) => setStockForm({ ...stockForm, purchase_date: e.target.value })} />
            </div>
            <button className="btn-primary w-full" disabled={addStock.isPending}>
              {addStock.isPending ? 'Adding...' : 'Add Stock'}
            </button>
          </form>
        </div>
      </div>

      <InventoryModal
        open={!!selectedPowder}
        powder={selectedPowder?.shade_name ?? null}
        fromDate={fromDate}
        toDate={toDate}
        activeTab={activeTab}
        usageRows={usageRows}
        stockRows={stockRows}
        loading={activeTab === 'usage' ? usageLoading : stockLoading}
        onClose={() => setSelectedPowder(null)}
        onFromChange={setFromDate}
        onToChange={setToDate}
        onTabChange={setActiveTab}
      />
    </div>
  )
}