import { useState } from 'react'
import ManageUsers from './ManageUsers'
import ActivityLog from './ActivityLog'

type Tab = 'users' | 'info' | 'activity'

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
      </div>

      {tab === 'users' && <ManageUsers />}
      {tab === 'activity' && <ActivityLog />}
      {tab === 'info' && <CompanyInfo />}
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
