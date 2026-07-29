import { useState } from 'react'
import ManageUsers from './ManageUsers'
import ActivityLog from './ActivityLog'
import api from '../api/client'

type Tab = 'users' | 'info' | 'activity' | 'ai_model'

export default function CompanySettings() {
  const [tab, setTab] = useState<Tab>('users')

  const tabClass = (t: Tab) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition ${
      tab === t ? 'bg-brand-500 text-white' : 'text-slate-500 hover:bg-slate-100'
    }`

  return (
    <div>
      <h2 className="text-xl font-semibold mb-1">Company Settings</h2>
      <p className="text-sm text-slate-400 mb-6">Manage who has access to your company's account.</p>

      <div className="flex gap-2 mb-6 border-b border-slate-100 pb-3">
        <button className={tabClass('users')} onClick={() => setTab('users')}>Manage Users</button>
        <button className={tabClass('activity')} onClick={() => setTab('activity')}>Activity Log</button>
        <button className={tabClass('info')} onClick={() => setTab('info')}>Company Info</button>
        <button className={tabClass('ai_model')} onClick={() => setTab('ai_model')}>Late-Risk Model</button>
      </div>

      {tab === 'users' && <ManageUsers />}
      {tab === 'activity' && <ActivityLog />}
      {tab === 'info' && <CompanyInfo />}
      {tab === 'ai_model' && <LateRiskModelPanel />}
    </div>
  )
}

function CompanyInfo() {
  return (
    <div className="card max-w-md">
      <p className="text-sm text-slate-500">
        Seat limits and subscription status for your company are set by your administrator.
        You can see your current usage under the <span className="font-medium">Manage Users</span> tab.
      </p>
    </div>
  )
}

function LateRiskModelPanel() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const retrain = async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.post('/jobs/ml/retrain-late-risk')
      setResult(data)
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Could not reach the retrain endpoint.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card max-w-lg">
      <p className="text-sm text-slate-500 mb-4">
        The late-delivery risk badge shown on the Jobs page is powered by a small model trained
        on this company's own completed jobs. Use this to check whether it has enough data yet,
        and see how accurate it currently is.
      </p>
      <button className="btn-primary" onClick={retrain} disabled={loading}>
        {loading ? 'Checking…' : 'Retrain & Check Model'}
      </button>

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

      {result && !result.trained && (
        <div className="mt-4 text-sm bg-amber-50 border border-amber-200 rounded-md p-3 text-amber-800">
          <p className="font-medium">Not trained yet.</p>
          <p>{result.reason}</p>
          <p className="mt-1 text-xs opacity-75">
            Jobs found with a completion date (approved/delivered): {result.n_samples}
          </p>
        </div>
      )}

      {result && result.trained && (
        <div className="mt-4 text-sm bg-green-50 border border-green-200 rounded-md p-3 text-green-800">
          <p className="font-medium">Model trained successfully.</p>
          <ul className="mt-1 space-y-0.5">
            <li>Trained on {result.n_samples} completed jobs</li>
            <li>Accuracy: {result.metrics.accuracy}</li>
            <li>Precision: {result.metrics.precision}</li>
            <li>Recall: {result.metrics.recall}</li>
            <li>F1: {result.metrics.f1}</li>
            <li className="text-xs opacity-70">
              (test set: {result.metrics.n_test} jobs, held out from {result.metrics.n_train} training jobs)
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}
