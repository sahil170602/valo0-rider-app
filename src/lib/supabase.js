import { createClient } from '@supabase/supabase-js'

// Replace the strings below with the actual values from your Supabase Dashboard
const supabaseUrl = 'https://bbluuberipphwfjpsnun.supabase.co' 
const supabaseAnonKey = 'sb_publishable_DziAMEowFfvY0XLlKqCoiw_7VQaepnC'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

console.log("✅ Supabase is now connected directly!");