export interface Company {
  id: string
  name: string
  subscription_status: 'active' | 'suspended'
  max_owners: number
  max_staff: number
  owner_count: number
  staff_count: number
  created_at: string
}

export interface ActivityLogEntry {
  id: string
  company_id: string | null
  actor_id: string
  actor_email: string
  actor_username?: string | null
  actor_role: string
  action: string
  entity_type: string
  entity_id?: string | null
  details: Record<string, any>
  created_at: string
}

export interface Supplier {
  id: string
  name: string
  contact_number?: string
}

export interface Customer {
  id: string
  name: string
  contact_number?: string
  address?: string
}

export interface Powder {
  id: string
  shade_name: string
  default_supplier_id?: string
  reorder_threshold_kg: number
  stock_kg: number
  low_stock?: boolean
}

export interface StockMovement {
  type: 'added' | 'used'
  date: string
  qty_kg: number
  price_per_kg: number
  supplier_name?: string
  job_number?: string
  notes?: string
}

export type JobStatus = 'received' | 'in_process' | 'approved' | 'delivered'
export type PaymentStatus = 'unpaid' | 'advance' | 'paid'
export type PaymentMethod = 'cash' | 'cheque' | 'upi' | 'bank_transfer' | 'card'
export interface PaymentEntry {
  id: string
  job_id: string
  amount: number
  payment_method: PaymentMethod
  paid_date: string
  created_at: string
}
export interface Job {
  id: string
  job_number: string
  customer_id: string
  customer_name: string
  product_name: string
  qty_received: number
  powder_id: string
  shade_name: string
  date_received: string
  date_promised: string
  date_completed?: string
  was_late: boolean
  status: JobStatus
  powder_consumed_kg?: number
  powder_cost?: number
  price_charged?: number
  payment_status: PaymentStatus
  payment_method?: PaymentMethod
  advance_amount: number
  notes?: string
}

export interface DashboardSummary {
  total_jobs: number
  pending_jobs: number
  late_jobs: number
  outstanding_receivables: number
  low_stock_powders: Powder[]
}

export interface Expense {
  id: string
  expense_date: string
  category: string
  description?: string
  amount: number
}

export type AssetType = 'depreciable' | 'land'

export interface Asset {
  id: string
  name: string
  asset_type: AssetType
  purchase_price: number
  purchase_date: string
  useful_life_years?: number | null
  monthly_depreciation?: number
  accumulated_depreciation?: number
  book_value?: number
}

export interface MonthlySummary {
  label: string
  period_start: string
  period_end: string
  revenue: number
  powder_cost: number
  gross_profit: number
  expenses_by_category: Record<string, number>
  total_expenses: number
  depreciation: number
  net_profit: number
  capital_purchases: Asset[]
  total_capital_purchases: number
}
