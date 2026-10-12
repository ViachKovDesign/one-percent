import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import { useCallback, useEffect, useRef, useState } from 'react'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config'
import { emptyData, ensureGoalWeek, merge, normalize, rollOver, type Data } from './model'

const LOCAL_KEY = 'one-percent:data'

/**
 * Что пришло в адресе после возвращения из Google через Supabase: ?code=… (успех) или ?error=…
 * Читаем до создания клиента Supabase — он сам забирает код из адреса.
 */
function captureAuthReturn(): { hadCode: boolean; error: string | null } {
  try {
    const query = new URLSearchParams(window.location.search)
    const hash = new URLSearchParams(window.location.hash.slice(1))
    const description = query.get('error_description') ?? hash.get('error_description')
    const error = query.get('error') ?? hash.get('error')
    return { hadCode: query.has('code'), error: error ? explainAuthError(description ?? error) : null }
  } catch {
    return { hadCode: false, error: null }
  }
}

/** Переводим частые ошибки входа на понятный язык и подсказываем, где чинить. */
export function explainAuthError(raw: string): string {
  const text = raw.replace(/\+/g, ' ')
  if (/exchange external code/i.test(text)) {
    return 'Google не принял ключ Supabase. Проверь Client Secret в Supabase → Authentication → Sign In / Providers → Google.'
  }
  if (/provider is not enabled|unsupported provider/i.test(text)) {
    return 'Вход через Google выключен в Supabase. Включи его: Authentication → Sign In / Providers → Google.'
  }
  if (/access_denied|access denied/i.test(text)) {
    return 'Google не дал доступ. Проверь, что твоя почта есть в Google Cloud → Audience → Test users.'
  }
  if (/code verifier|flow state|auth code/i.test(text)) {
    return 'Вход начался в одном окне, а закончился в другом. Открой сайт в браузере (не с иконки на экране) и войди ещё раз.'
  }
  if (/relation .*user_data.* does not exist|user_data/i.test(text)) {
    return 'В базе нет таблицы для дел. Выполни скрипт в Supabase → SQL Editor.'
  }
  return `Ошибка входа: ${text}`
}

const AUTH_RETURN = captureAuthReturn()

export const supabase: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? // PKCE: Supabase возвращает ?code= в адресе, а не #access_token — не путается со входом в календарь
      createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { flowType: 'pkce' } })
    : null

/** Утренняя подготовка дня: перенос невыполненного и шаги целей на неделю вперёд. */
export function prepareDay(data: Data): Data {
  return ensureGoalWeek(rollOver(data))
}

export type SyncStatus = 'local' | 'syncing' | 'synced' | 'offline' | 'error'

const PRISTINE_KEY = 'one-percent:pristine'

/**
 * «Нетронутое» устройство: данные — только стандартные шаблоны и привычки, человек ещё ничего не менял.
 * При первом входе такое устройство берёт данные из облака целиком, а не склеивает со своими —
 * иначе стандартные шаблоны и привычки задвоятся.
 */
function isPristine(): boolean {
  try {
    return localStorage.getItem(PRISTINE_KEY) === '1'
  } catch {
    return false
  }
}

function setPristine(value: boolean) {
  try {
    if (value) localStorage.setItem(PRISTINE_KEY, '1')
    else localStorage.removeItem(PRISTINE_KEY)
  } catch {
    // без хранилища считаем устройство обычным
  }
}

function loadLocal(): Data {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (raw) return normalize(JSON.parse(raw) as Partial<Data>)
  } catch {
    // повреждённые или недоступные данные — начинаем с чистого листа
  }
  setPristine(true)
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
  const [authError, setAuthError] = useState<string | null>(AUTH_RETURN.error)
  const [syncError, setSyncError] = useState<string | null>(null)
  const dataRef = useRef(data)
  const timer = useRef<number | undefined>(undefined)
  const syncing = useRef(false)

  dataRef.current = data

  /** Сверяет с облаком. true — всё сохранено, false — не получилось (нет сети, ошибка). */
  const sync = useCallback(async (): Promise<boolean> => {
    const userId = session?.user.id
    if (!supabase || !userId || syncing.current) return false
    if (!navigator.onLine) {
      setStatus('offline')
      return false
    }
    syncing.current = true
    setStatus('syncing')
    try {
      const remote = await pullRemote(supabase, userId)
      const base = remote ? (isPristine() ? remote : merge(dataRef.current, remote)) : dataRef.current
      const merged = prepareDay(base)
      await pushRemote(supabase, userId, merged)
      // Пока шёл запрос, могли появиться новые правки: доклеиваем их сверху.
      // Нетронутое устройство ничего своего не добавляет — берём облако как есть.
      const latest = isPristine() ? merged : merge(merged, dataRef.current)
      setPristine(false)
      dataRef.current = latest
      setData(latest)
      saveLocal(latest)
      setStatus('synced')
      setSyncError(null)
      return true
    } catch (error) {
      setStatus(navigator.onLine ? 'error' : 'offline')
      if (navigator.onLine) setSyncError(explainAuthError((error as { message?: string })?.message ?? String(error)))
      return false
    } finally {
      syncing.current = false
    }
  }, [session])

  // Вход и выход
  useEffect(() => {
    if (!supabase) return
    void (async () => {
      const init = await supabase.auth.initialize()
      const { data } = await supabase.auth.getSession()
      setSession(data.session)
      if (!data.session && AUTH_RETURN.hadCode) {
        setAuthError(
          init.error
            ? explainAuthError(init.error.message)
            : 'Google вернул в приложение, но вход не завершился. Попробуй ещё раз в браузере.',
        )
      }
      // Убираем ?code= и ?error= из адреса, чтобы они не мешали при перезагрузке
      if (AUTH_RETURN.hadCode || AUTH_RETURN.error) history.replaceState(null, '', window.location.pathname)
    })()
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      if (next) setAuthError(null)
    })
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
      setPristine(false)
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

  /**
   * Выход: сначала сохраняем последние изменения в облако, потом стираем дела с этого устройства —
   * чтобы на чужом компьютере после выхода никто их не увидел. В облаке всё остаётся.
   * Возвращает false, если человек передумал выходить.
   */
  const signOut = useCallback(async (): Promise<boolean> => {
    if (!supabase) return false
    const saved = await sync()
    if (!saved && !window.confirm('Не получилось сохранить последние изменения в облако. Всё равно выйти? Несохранённое пропадёт.')) {
      return false
    }
    await supabase.auth.signOut()
    try {
      localStorage.removeItem(LOCAL_KEY)
    } catch {
      // нечего стирать
    }
    setPristine(true)
    const fresh = prepareDay(emptyData())
    dataRef.current = fresh
    setData(fresh)
    return true
  }, [sync])

  return { data, change, session, status, signIn, signOut, canSync: Boolean(supabase), sync, authError, syncError }
}
