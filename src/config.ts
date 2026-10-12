// Ключи проекта Supabase (Project Settings → API).
// Ключ «anon public» можно хранить в открытом коде: доступ к данным закрывают правила базы (RLS),
// каждый пользователь видит только свои записи.
// Пока поля пустые, приложение работает только на этом устройстве, без входа.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? ''
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

// Google Календарь: «ID клиента OAuth» из Google Cloud Console (APIs & Services → Credentials).
// Это не секрет — он виден любому, кто открывает сайт. Пустая строка — синхронизация выключена.
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''
