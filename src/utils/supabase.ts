import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://rvswrzxdzfdtenxqtbci.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2c3dyenhkemZkdGVueHF0YmNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU4Njg0MjAsImV4cCI6MjA2MTQ0NDQyMH0.cdvoEv3jHuYdPHnR9Xf_mkVyKgupSRJFLi25KMtqaNk'
)
