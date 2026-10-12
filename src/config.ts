// Ключи проекта Supabase (Project Settings → API).
// Ключ «anon public» можно хранить в открытом коде: доступ к данным закрывают правила базы (RLS),
// каждый пользователь видит только свои записи.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://qtguhxlhiujcfywxnftu.supabase.co'
export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0Z3VoeGxoaXVqY2Z5d3huZnR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4MjU5MjUsImV4cCI6MjEwNzQwMTkyNX0.bLDFWZorCyHX2V0gm8Vu6FCAkFcKxU-3o_60wsWF2LU'

// Google Календарь: «ID клиента OAuth» из Google Cloud Console (APIs & Services → Credentials).
// Это не секрет — он виден любому, кто открывает сайт. Пустая строка — синхронизация выключена.
export const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID || '713330032288-ks4iehvju8r7vjrjigrqebt76c3c6dg3.apps.googleusercontent.com'
