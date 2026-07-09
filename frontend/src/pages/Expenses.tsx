import { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { Asset, AssetType } from '../types'
import {
  useExpenses, useAssets, useExpenseSummary, useAddExpense, useDeleteExpense, useAddAsset, useDeleteAsset,
} from '../hooks/queries'

const currentMonth = () => new Date().toISOString().slice(0, 7) // YYYY-MM
const today = () => new Date().toISOString().slice(0, 10)

// Indian Financial Year: April 1 – March 31
const currentFYStartYear = () => {
  const now = new Date()
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
}
const fyOptions = () => {
  const start = currentFYStartYear()
  return [start + 1, start, start - 1, start - 2].map((y) => ({
    year: y,
    label: `FY ${y}-${String(y + 1).slice(2)}`,
    from: `${y}-04-01`,
    to: `${y + 1}-03-31`,
  }))
}

type PeriodMode = 'month' | 'fy'

export default function Expenses() {
  const [periodMode, setPeriodMode] = useState<PeriodMode>('month')
  const [month, setMonth] = useState(currentMonth())
  const [fyYear, setFyYear] = useState(currentFYStartYear())

  const [expenseForm, setExpenseForm] = useState({
    expense_date: today(), category: 'wages', description: '', amount: '',
  })
  const [assetForm, setAssetForm] = useState<{ name: string; asset_type: AssetType; purchase_price: string; purchase_date: string; useful_life_years: string }>({
    name: '', asset_type: 'depreciable', purchase_price: '', purchase_date: today(), useful_life_years: '5',
  })

  const fyOpts = useMemo(fyOptions, [])
  const activeFy = fyOpts.find((f) => f.year === fyYear) || fyOpts[1]

  const expensesParams = periodMode === 'month' ? { month } : { from: activeFy.from, to: activeFy.to }
  const periodParams = periodMode === 'month'
    ? { month }
    : { from: activeFy.from, to: activeFy.to, label: activeFy.label }

  const { data: expenses = [] } = useExpenses(expensesParams)
  const { data: assets = [] } = useAssets()
  const { data: summary } = useExpenseSummary(periodParams)

  const addExpenseMutation = useAddExpense()
  const deleteExpenseMutation = useDeleteExpense()
  const addAssetMutation = useAddAsset()
  const deleteAssetMutation = useDeleteAsset()

  const addExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!expenseForm.amount) return
    await addExpenseMutation.mutateAsync({ ...expenseForm, amount: parseFloat(expenseForm.amount) })
    setExpenseForm({ expense_date: today(), category: 'wages', description: '', amount: '' })
  }

  const deleteExpense = (id: string) => deleteExpenseMutation.mutate(id)

  const addAsset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!assetForm.name || !assetForm.purchase_price) return
    await addAssetMutation.mutateAsync({
      name: assetForm.name,
      asset_type: assetForm.asset_type,
      purchase_price: parseFloat(assetForm.purchase_price),
      purchase_date: assetForm.purchase_date,
      useful_life_years: assetForm.asset_type === 'land' ? null : parseFloat(assetForm.useful_life_years || '5'),
    })
    setAssetForm({ name: '', asset_type: 'depreciable', purchase_price: '', purchase_date: today(), useful_life_years: '5' })
  }

  const deleteAsset = (id: string) => deleteAssetMutation.mutate(id)

  const depreciableAssets = assets.filter((a: Asset) => a.asset_type === 'depreciable')
  const capitalAssets = assets.filter((a: Asset) => a.asset_type === 'land')

  const exportToExcel = () => {
    if (!summary) return
    const wb = XLSX.utils.book_new()

    const plRows: (string | number)[][] = [
      ['Profit & Loss Statement'],
      [summary.label],
      [`Period: ${summary.period_start} to ${summary.period_end}`],
      [],
      ['Revenue (Job Income)', summary.revenue],
      ['Less: Powder Cost (Cost of Goods Sold)', -summary.powder_cost],
      ['Gross Profit', summary.gross_profit],
      [],
      ['Operating Expenses'],
      ...Object.entries(summary.expenses_by_category).map(([k, v]) => [`  ${k[0].toUpperCase()}${k.slice(1)}`, -v]),
      ['Total Operating Expenses', -summary.total_expenses],
      [],
      ['Depreciation', -summary.depreciation],
      [],
      ['Net Profit', summary.net_profit],
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(plRows), 'P&L Statement')

    const expRows = [
      ['Date', 'Category', 'Description', 'Amount'],
      ...expenses.map((e) => [e.expense_date, e.category, e.description || '', e.amount]),
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(expRows), 'Expenses')

    const assetRows = [
      ['Name', 'Type', 'Purchase Date', 'Purchase Price', 'Useful Life (yrs)', 'Monthly Depreciation', 'Book Value'],
      ...assets.map((a: Asset) => [
        a.name,
        a.asset_type === 'land' ? 'Land / Capital' : 'Depreciable',
        a.purchase_date,
        a.purchase_price,
        a.useful_life_years || '-',
        a.monthly_depreciation || 0,
        a.book_value ?? a.purchase_price,
      ]),
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(assetRows), 'Fixed Asset Register')

    XLSX.writeFile(wb, `Report_${summary.label.replace(/\s+/g, '_')}.xlsx`)
  }

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <h2 className="text-xl font-semibold">Expenses</h2>
        <div className="flex gap-2 items-center flex-wrap">
          <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-medium">
            <button
              className={`px-3 py-2 ${periodMode === 'month' ? 'bg-brand-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              onClick={() => setPeriodMode('month')}
            >
              Monthly
            </button>
            <button
              className={`px-3 py-2 ${periodMode === 'fy' ? 'bg-brand-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              onClick={() => setPeriodMode('fy')}
            >
              Financial Year
            </button>
          </div>
          {periodMode === 'month' ? (
            <input type="month" className="input w-auto" value={month} onChange={(e) => setMonth(e.target.value)} />
          ) : (
            <select className="input w-auto" value={fyYear} onChange={(e) => setFyYear(Number(e.target.value))}>
              {fyOpts.map((f) => <option key={f.year} value={f.year}>{f.label}</option>)}
            </select>
          )}
          <button className="btn-secondary" onClick={exportToExcel} disabled={!summary}>
            ⬇ Export to Excel
          </button>
        </div>
      </div>

      {/* ---------------- Profit & Loss statement, laid out like a formal report ---------------- */}
      {summary && (
        <div className="card mb-8">
          <div className="flex justify-between items-baseline mb-4">
            <h3 className="font-semibold">Profit &amp; Loss Statement</h3>
            <span className="text-xs text-slate-400">{summary.label} &middot; {new Date(summary.period_start).toLocaleDateString('en-IN')} – {new Date(summary.period_end).toLocaleDateString('en-IN')}</span>
          </div>

          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="py-1.5">Revenue (Job Income)</td>
                <td className="py-1.5 text-right font-medium">₹{summary.revenue.toLocaleString('en-IN')}</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-1.5 text-slate-500">Less: Powder Cost (Cost of Goods Sold)</td>
                <td className="py-1.5 text-right text-slate-500">(₹{summary.powder_cost.toLocaleString('en-IN')})</td>
              </tr>
              <tr className="border-b-2 border-slate-200">
                <td className="py-1.5 font-semibold">Gross Profit</td>
                <td className="py-1.5 text-right font-semibold">₹{summary.gross_profit.toLocaleString('en-IN')}</td>
              </tr>

              <tr><td colSpan={2} className="pt-3 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wide">Operating Expenses</td></tr>
              {Object.entries(summary.expenses_by_category).map(([cat, amt]) => (
                <tr key={cat} className="border-b border-slate-50">
                  <td className="py-1.5 pl-4 text-slate-500 capitalize">{cat}</td>
                  <td className="py-1.5 text-right text-slate-500">(₹{amt.toLocaleString('en-IN')})</td>
                </tr>
              ))}
              {Object.keys(summary.expenses_by_category).length === 0 && (
                <tr><td className="py-1.5 pl-4 text-slate-300 italic">No expenses recorded</td><td></td></tr>
              )}
              <tr className="border-b border-slate-100">
                <td className="py-1.5 font-medium">Total Operating Expenses</td>
                <td className="py-1.5 text-right font-medium">(₹{summary.total_expenses.toLocaleString('en-IN')})</td>
              </tr>

              <tr className="border-b-2 border-slate-200">
                <td className="py-1.5 text-slate-500">Less: Depreciation</td>
                <td className="py-1.5 text-right text-slate-500">(₹{summary.depreciation.toLocaleString('en-IN')})</td>
              </tr>

              <tr>
                <td className="pt-3 font-bold text-base">Net Profit</td>
                <td className={`pt-3 text-right font-bold text-base ${summary.net_profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  ₹{summary.net_profit.toLocaleString('en-IN')}
                </td>
              </tr>
            </tbody>
          </table>

          {summary.total_capital_purchases > 0 && (
            <div className="mt-5 pt-4 border-t border-dashed border-slate-200">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Capital Purchases This Period (Balance Sheet — not part of Net Profit)</p>
              {summary.capital_purchases.map((a) => (
                <div key={a.id} className="flex justify-between text-sm py-1">
                  <span className="text-slate-600">{a.name}</span>
                  <span className="font-medium">₹{a.purchase_price.toLocaleString('en-IN')}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm pt-1.5 border-t border-slate-100 mt-1 font-semibold">
                <span>Total Capital Purchases</span>
                <span>₹{summary.total_capital_purchases.toLocaleString('en-IN')}</span>
              </div>
              <p className="text-xs text-slate-400 mt-2">Land and other non-depreciating capital purchases add to your asset base but aren't treated as a monthly expense — that's why Net Profit above doesn't include them.</p>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* -------- Expenses (recurring) -------- */}
        <div className="card">
          <h3 className="font-semibold mb-3 text-sm">Add Expense <span className="text-slate-400 font-normal">(recurring — wages, electricity, etc.)</span></h3>
          <form onSubmit={addExpense} className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="label">Category</label>
              <select className="input" value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}>
                <option value="wages">Wages</option>
                <option value="electricity">Electricity</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" required value={expenseForm.expense_date} onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })} />
            </div>
            <div>
              <label className="label">Amount (₹)</label>
              <input type="number" step="0.01" className="input" required value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} />
            </div>
            <div>
              <label className="label">Description</label>
              <input className="input" value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} placeholder="optional" />
            </div>
            <div className="col-span-2">
              <button className="btn-primary w-full" disabled={addExpenseMutation.isPending}>
                {addExpenseMutation.isPending ? 'Adding...' : 'Add Expense'}
              </button>
            </div>
          </form>

          <div className="max-h-64 overflow-y-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Category</th>
                  <th className="pb-2">Amount</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id} className="border-b border-slate-50">
                    <td className="py-2 text-slate-500 whitespace-nowrap">{new Date(e.expense_date).toLocaleDateString('en-IN')}</td>
                    <td className="py-2 capitalize">{e.category}{e.description ? ` — ${e.description}` : ''}</td>
                    <td className="py-2">₹{e.amount.toLocaleString('en-IN')}</td>
                    <td className="py-2"><button className="text-red-400 text-xs hover:underline" onClick={() => deleteExpense(e.id)}>Delete</button></td>
                  </tr>
                ))}
                {expenses.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-slate-400">No expenses this period.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* -------- Assets: depreciable + land/capital -------- */}
        <div className="card">
          <h3 className="font-semibold mb-3 text-sm">Add Asset / Capital Purchase</h3>
          <form onSubmit={addAsset} className="grid grid-cols-2 gap-3 mb-4">
            <div className="col-span-2">
              <label className="label">Type</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={`py-2 rounded-lg text-sm font-medium border ${assetForm.asset_type === 'depreciable' ? 'bg-brand-50 border-brand-500 text-brand-600' : 'border-slate-200 text-slate-600'}`}
                  onClick={() => setAssetForm({ ...assetForm, asset_type: 'depreciable' })}
                >
                  Depreciable (furniture, equipment)
                </button>
                <button
                  type="button"
                  className={`py-2 rounded-lg text-sm font-medium border ${assetForm.asset_type === 'land' ? 'bg-brand-50 border-brand-500 text-brand-600' : 'border-slate-200 text-slate-600'}`}
                  onClick={() => setAssetForm({ ...assetForm, asset_type: 'land' })}
                >
                  Land / Capital (doesn't depreciate)
                </button>
              </div>
            </div>
            <div className="col-span-2">
              <label className="label">{assetForm.asset_type === 'land' ? 'Property / Asset Name' : 'Asset Name'}</label>
              <input className="input" required value={assetForm.name} onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })} placeholder={assetForm.asset_type === 'land' ? 'e.g. Plot at MIDC, Thane' : 'e.g. Office TV'} />
            </div>
            <div className={assetForm.asset_type === 'land' ? 'col-span-2' : ''}>
              <label className="label">Purchase Price (₹)</label>
              <input type="number" step="0.01" className="input" required value={assetForm.purchase_price} onChange={(e) => setAssetForm({ ...assetForm, purchase_price: e.target.value })} placeholder={assetForm.asset_type === 'land' ? 'Can be a large one-time amount' : ''} />
            </div>
            {assetForm.asset_type === 'depreciable' && (
              <div>
                <label className="label">Useful Life (years)</label>
                <input type="number" step="0.5" className="input" required value={assetForm.useful_life_years} onChange={(e) => setAssetForm({ ...assetForm, useful_life_years: e.target.value })} />
              </div>
            )}
            <div className="col-span-2">
              <label className="label">Purchase Date</label>
              <input type="date" className="input" required value={assetForm.purchase_date} onChange={(e) => setAssetForm({ ...assetForm, purchase_date: e.target.value })} />
            </div>
            <div className="col-span-2">
              <button className="btn-primary w-full" disabled={addAssetMutation.isPending}>
                {addAssetMutation.isPending ? 'Adding...' : 'Add'}
              </button>
            </div>
          </form>

          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 mt-5">Depreciable Assets</p>
          <div className="max-h-40 overflow-y-auto scrollbar-thin mb-4">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="pb-2">Asset</th>
                  <th className="pb-2">Book Value</th>
                  <th className="pb-2">Monthly Dep.</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {depreciableAssets.map((a: Asset) => (
                  <tr key={a.id} className="border-b border-slate-50">
                    <td className="py-2">{a.name}</td>
                    <td className="py-2 text-slate-500">₹{(a.book_value ?? a.purchase_price).toLocaleString('en-IN')}</td>
                    <td className="py-2 text-slate-500">₹{(a.monthly_depreciation ?? 0).toFixed(2)}</td>
                    <td className="py-2"><button className="text-red-400 text-xs hover:underline" onClick={() => deleteAsset(a.id)}>Delete</button></td>
                  </tr>
                ))}
                {depreciableAssets.length === 0 && <tr><td colSpan={4} className="py-3 text-center text-slate-400">None added yet.</td></tr>}
              </tbody>
            </table>
          </div>

          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Land &amp; Capital Purchases <span className="normal-case font-normal">(balance sheet only)</span></p>
          <div className="max-h-40 overflow-y-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="pb-2">Name</th>
                  <th className="pb-2">Purchased</th>
                  <th className="pb-2">Value</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {capitalAssets.map((a: Asset) => (
                  <tr key={a.id} className="border-b border-slate-50">
                    <td className="py-2">{a.name}</td>
                    <td className="py-2 text-slate-500">{new Date(a.purchase_date).toLocaleDateString('en-IN')}</td>
                    <td className="py-2 text-slate-500">₹{a.purchase_price.toLocaleString('en-IN')}</td>
                    <td className="py-2"><button className="text-red-400 text-xs hover:underline" onClick={() => deleteAsset(a.id)}>Delete</button></td>
                  </tr>
                ))}
                {capitalAssets.length === 0 && <tr><td colSpan={4} className="py-3 text-center text-slate-400">None added yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}