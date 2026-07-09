import { useState } from 'react'
import api from '../api/client'
import { Supplier } from '../types'

interface Props {
  suppliers: Supplier[]
  value: string
  onChange: (id: string) => void
  onCreated: (supplier: Supplier) => void
  required?: boolean
}

const ADD_NEW = '__add_new__'

export default function SupplierSelect({ suppliers, value, onChange, onCreated, required }: Props) {
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSelect = (v: string) => {
    if (v === ADD_NEW) {
      setAdding(true)
      return
    }
    onChange(v)
  }

  const saveNew = async () => {
    if (!newName.trim()) return
    setSaving(true)
    try {
      const res = await api.post('/suppliers/', { name: newName.trim() })
      onCreated(res.data)
      onChange(res.data.id)
      setAdding(false)
      setNewName('')
    } finally {
      setSaving(false)
    }
  }

  if (adding) {
    return (
      <div className="flex gap-2">
        <input
          className="input"
          autoFocus
          placeholder="New supplier name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveNew() } }}
        />
        <button type="button" className="btn-secondary shrink-0" disabled={saving} onClick={saveNew}>
          {saving ? '...' : 'Save'}
        </button>
        <button type="button" className="text-xs text-slate-400 shrink-0" onClick={() => setAdding(false)}>
          Cancel
        </button>
      </div>
    )
  }

  return (
    <select className="input" required={required} value={value} onChange={(e) => handleSelect(e.target.value)}>
      <option value="">Select supplier</option>
      {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      <option value={ADD_NEW}>+ Add new supplier</option>
    </select>
  )
}
