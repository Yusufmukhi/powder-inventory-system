import axios from 'axios'
import { supabase } from './supabaseClient'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
})

api.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 402) {
      window.dispatchEvent(new Event('subscription-inactive'))
    }
    return Promise.reject(error)
  }
)

export default api
