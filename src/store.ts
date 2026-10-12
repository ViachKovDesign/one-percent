import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import { useCallback, useEffect, useRef, useState } from 'react'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config'
import { emptyData, ensureGoalTasks, merge, normalize, rollOver, type Data } from './model'

const LOCAL_KEY = 'one-percent:data'

export const supabase: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null

/** Утренняя подготовка дня: перенос невыполненного и шаги целей на сегодня. */
function prepareDay(data: Data): Data {
  return ensureGoalTasks(rollOver(data))
}

export type SyncStatus = 'local' | 'syncing' | 'synced' | 'offline' | 'error'

function loadLocal(): Data {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (raw) return normalize(JSON.parse(raw) as Partial<Data>)
  } catch {
    // повреждённые или недоступные данные — начинаем с чистого листа
  }
  return emptyData()
}

function saveLocal(data: Data) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(data))
  } catch {
    // нет места или приватный режим: данные останутся в памяти до закрытия вкладки
  }
}

async function pullRemote(client: SupabaseClient, userId: string): Promise<Data | null> {
  const { data, error } = await client.from('user_data').select('data').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data?.data ? normalize(data.data as Partial<Data>) : null
}

async function pushRemote(client: SupabaseClient, userId: string, data: Data) {
  const { error } = await client
    .from('user_data')
    .upsert({ user_id: userId, data, updated_at: new Date().toISOString() })
  if (error) throw error
}

export function useStore() {
  const [data, setData] = useState<Data>(() => prepareDay(loadLocal()))
  const [session, setSession] = useState<Session | null>(null)
  const [status, setStatus] = useState<SyncStatus>('local')
  const dataRef = useRef(data)
  const timer = useRef<number | undefined>(undefined)
  const syncing = useRef(false)

  dataRef.current = data

  const sync = useCallback(async () => {
    const userId = session?.user.id
    if (!supabase || !userId || syncing.current) return
    if (!navigator.onLine) {
      setStatus('offline')
      return
    }
    syncing.current = true
    setStatus('syncing')
    try {
      const remote = await pullRemote(supabase, userId)
      const merged = prepareDay(remote ? merge(dataRef.current, remote) : dataRef.current)
      await pushRemote(supabase, userId, merged)
      // Пока шёл запрос, могли появиться новые правки: доклеиваем их сверху.
      const latest = merge(merged, dataRef.current)
      dataRef.current = latest
      setData(latest)
      saveLocal(latest)
      setStatus('synced')
    } catch {
      setStatus(navigator.onLine ? 'error' : 'offline')
    } finally {
      syncing.current = false
    }
  }, [session])

  // Вход и выход
  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => sub.subscription.unsubscribe()
  }, [])

  // Новый день: при возвращении в приложение переносим дела и кладём шаги целей
  useEffect(() => {
    const onWake = () => {
      if (document.visibilityState !== 'visible') return
      setData(current => {
        const next = prepareDay(current)
        if (next !== current) {
          dataRef.current = next
          saveLocal(next)
        }
        return next
      })
    }
    window.addEventListener('focus', onWake)
    document.addEventListener('visibilitychange', onWake)
    return () => {
      window.removeEventListener('focus', onWake)
      document.removeEventListener('visibilitychange', onWake)
    }
  }, [])

  // Синхронизация при входе, при возвращении в приложение и при появлении сети
  useEffect(() => {
    if (!session) {
      setStatus('local')
      return
    }
    void sync()
    const onWake = () => document.visibilityState === 'visible' && void sync()
    window.addEventListener('online', onWake)
    window.addEventListener('focus', onWake)
    document.addEventListener('visibilitychange', onWake)
    return () => {
      window.removeEventListener('online', onWake)
      window.removeEventListener('focus', onWake)
      document.removeEventListener('visibilitychange', onWake)
    }
  }, [session, sync])

  /** Любое изменение данных: сохраняем на устройстве и через секунду отправляем в облако. */
  const change = useCallback(
    (fn: (current: Data) => Data) => {
      setData(current => {
        const next = fn(current)
        dataRef.current = next
        saveLocal(next)
        return next
      })
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => void sync(), 1000)
    },
    [sync],
  )

  const signIn = useCallback(async () => {
    if (!supabase) return
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + import.meta.env.BASE_URL },
    })
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) return
    await supabase.auth.signOut()
  }, [])

  return { data, change, session, status, signIn, signOut, canSync: Boolean(supabase), sync }
}
