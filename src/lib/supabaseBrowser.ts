'use client';

import { createBrowserClient } from '@supabase/ssr';

const url = 'https://rvswrzxdzfdtenxqtbci.supabase.co'; // ta vraie URL ici
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2c3dyenhkemZkdGVueHF0YmNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU4Njg0MjAsImV4cCI6MjA2MTQ0NDQyMH0.cdvoEv3jHuYdPHnR9Xf_mkVyKgupSRJFLi25KMtqaNk';     // ta vraie ANON_KEY ici

const supabase = createBrowserClient(url, key);

export default supabase;
