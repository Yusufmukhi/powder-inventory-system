import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  console.error(
    'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in frontend/.env for login to work.'
  )
}

export const supabase = createClient(url, anonKey)
