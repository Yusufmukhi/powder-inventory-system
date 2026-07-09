import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../api/client'
import {
  Asset, Company, Customer, DashboardSummary, Expense, MonthlySummary, Powder, Supplier,
} from '../types'

// ---------------------------------------------------------------------
// Query keys — kept in one place so invalidation calls elsewhere in this
// file can't drift out of sync with what each hook actually queries.
// ---------------------------------------------------------------------
export const queryKeys = {
  customers: ['customers'] as const,
  powders: ['powders'] as const,
  suppliers: ['suppliers'] as const,
  jobs: ['jobs'] as const,
  dashboardSummary: ['dashboard-summary'] as const,
  expenses: (params: Record<string, string | undefined>) => ['expenses', params] as const,
  assets: ['assets'] as const,
  expenseSummary: (params: Record<string, string | undefined>) => ['expense-summary', params] as const,
  activityLog: ['activity-log'] as const,
  users: ['users'] as const,
  companies: ['companies'] as const,
}

// ---------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------
export function useCustomers() {
  return useQuery({
    queryKey: queryKeys.customers,
    queryFn: () => api.get<Customer[]>('/customers/').then((r) => r.data),
  })
}

export function usePowders() {
  return useQuery({
    queryKey: queryKeys.powders,
    queryFn: () => api.get<Powder[]>('/powders/').then((r) => r.data),
  })
}

export function useSuppliers() {
  return useQuery({
    queryKey: queryKeys.suppliers,
    queryFn: () => api.get<Supplier[]>('/suppliers/').then((r) => r.data),
  })
}

export function useJobs() {
  return useQuery({
    queryKey: queryKeys.jobs,
    queryFn: () => api.get('/jobs/').then((r) => r.data),
  })
}

export function useDashboardSummary() {
  return useQuery({
    queryKey: queryKeys.dashboardSummary,
    queryFn: () => api.get<DashboardSummary>('/jobs/dashboard/summary').then((r) => r.data),
  })
}

export function useExpenses(params: Record<string, string | undefined>) {
  return useQuery({
    queryKey: queryKeys.expenses(params),
    queryFn: () => api.get<Expense[]>('/expenses/', { params }).then((r) => r.data),
  })
}

export function useAssets() {
  return useQuery({
    queryKey: queryKeys.assets,
    queryFn: () => api.get<Asset[]>('/expenses/assets/list').then((r) => r.data),
  })
}

export function useExpenseSummary(params: Record<string, string | undefined>) {
  return useQuery({
    queryKey: queryKeys.expenseSummary(params),
    queryFn: () => api.get<MonthlySummary>('/expenses/summary', { params }).then((r) => r.data),
  })
}

export function useActivityLog() {
  return useQuery({
    queryKey: queryKeys.activityLog,
    queryFn: () => api.get('/auth/activity-log').then((r) => r.data),
  })
}

export function useUsers() {
  return useQuery({
    queryKey: queryKeys.users,
    queryFn: () => api.get('/auth/users').then((r) => r.data),
  })
}

export function useCompanies() {
  return useQuery({
    queryKey: queryKeys.companies,
    queryFn: () => api.get<Company[]>('/companies/').then((r) => r.data),
  })
}

// ---------------------------------------------------------------------
// Writes — each mutation invalidates exactly the query keys its endpoint
// can affect, so every screen showing that data refreshes automatically
// without a manual reload() call.
// ---------------------------------------------------------------------
export function useCreateCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: { name: string; contact_number: string; address: string }) =>
      api.post('/customers/', payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.customers }),
  })
}

export function useCreatePowder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: { shade_name: string; default_supplier_id: string | null }) =>
      api.post('/powders/', payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.powders }),
  })
}

export function useAddStock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: any) => api.post('/powders/stock-in', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.powders })
      qc.invalidateQueries({ queryKey: queryKeys.dashboardSummary })
    },
  })
}

export function useMarkJobDelivered() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (jobId: string) => api.patch(`/jobs/${jobId}/deliver`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.jobs })
      qc.invalidateQueries({ queryKey: queryKeys.dashboardSummary })
    },
  })
}

export function useStartJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (jobId: string) => api.patch(`/jobs/${jobId}/start`),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.jobs }),
  })
}

// Generic "this write happened elsewhere (JobForm / ApproveJobModal /
// PaymentModal), now refresh what it could have touched" — used from the
// onDone callbacks those modals already expose.
export function useInvalidateJobsRelated() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: queryKeys.jobs })
    qc.invalidateQueries({ queryKey: queryKeys.powders })
    qc.invalidateQueries({ queryKey: queryKeys.dashboardSummary })
  }
}

export function useAddExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: any) => api.post('/expenses/', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['expense-summary'] })
    },
  })
}

export function useDeleteExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/expenses/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['expense-summary'] })
    },
  })
}

export function useAddAsset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: any) => api.post('/expenses/assets', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.assets })
      qc.invalidateQueries({ queryKey: ['expense-summary'] })
    },
  })
}

export function useDeleteAsset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/expenses/assets/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.assets })
      qc.invalidateQueries({ queryKey: ['expense-summary'] })
    },
  })
}

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: { email: string; username: string; password: string; role: string }) =>
      api.post('/auth/users', payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.users }),
  })
}

export function useRemoveUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/auth/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.users }),
  })
}

export function useCreateCompany() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: any) => api.post('/companies/', payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.companies }),
  })
}

export function useToggleCompanySuspend() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/companies/${id}`, { subscription_status: status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.companies }),
  })
}
