import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://vihxecnwonwmqclaxubn.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpaHhlY253b253bXFjbGF4dWJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1ODU2ODgsImV4cCI6MjA5NTE2MTY4OH0.tWV_fW4kbXUmtuekVzZczly2XcVt0azYCWFXyjloI_M'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
