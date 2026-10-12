// Синхронизация с Google Календарём.
// Приложение само создаёт события для дел со временем, ставит напоминание,
// помечает выполненные (✓, серым, без напоминания) и удаляет удалённые.
// Вход — через страницу Google (редирект), поэтому работает и в установленном на телефон приложении.

import { useCallback, useEffect, useRef, useState } from 'react'
import { GOOGLE_CLIENT_ID } from './config'
import { addDays, todayKey } from './dates'
import type { Data, Task } from './model'

const SCOPE = 'https://www.googleapis.com/auth/calendar.events'
const API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
const TOKEN_KEY = 'one-percent:gcal-token'
const SYNCED_KEY = 'one-percent:gcal-synced'
const ENABLED_KEY = 'one-percent:gcal-enabled'
const STATE_KEY = 'one-percent:gcal-state'
const REMIND_KEY = 'one-percent:remind'

/* ─────────────── Настройки ─────────────── */

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // нет доступа к хранилищу — настройка проживёт до закрытия вкладки
  }
}

export function getRemindMin(): number {
  const value = Number(read(REMIND_KEY))
  return Number.isFinite(value) && value > 0 ? value : 10
}

export function setRemindMin(minutes: number) {
  write(REMIND_KEY, String(minutes))
}

/* ─────────────── Что отправить в календарь ─────────────── */

export type SyncOp = { kind: 'upsert'; task: Task; sig: string } | { kind: 'delete'; taskId: string }

/** Отпечаток дела: если он не изменился, событие в календаре трогать не нужно. */
export function taskSig(task: Task, remindMin: number): string {
  return JSON.stringify([task.title, task.date, task.time, task.done, task.important, remindMin])
}

/**
 * Сравнивает дела с тем, что уже лежит в календаре, и решает, что поменять.
 * В календарь идут дела со временем, начиная со вчерашнего дня.
 */
export function planSync(data: Data, synced: Record<string, string>, today: string, remindMin: number): SyncOp[] {
  const from = addDays(today, -1)
  const ops: SyncOp[] = []
  for (const task of Object.values(data.tasks)) {
    const wanted = !task.deleted && task.time !== null && task.date >= from
    if (wanted) {
      const sig = taskSig(task, remindMin)
      if (synced[task.id] !== sig) ops.push({ kind: 'upsert', task, sig })
    } else if (synced[task.id] && (task.deleted || task.time === null)) {
      ops.push({ kind: 'delete', taskId: task.id })
    }
  }
  return ops
}

/** id события у Google: только символы a–v и 0–9. Берём байты id дела в шестнадцатеричном виде. */
export function eventId(taskId: string): string {
  return Array.from(new TextEncoder().encode(taskId), b => b.toString(16).padStart(2, '0')).join('')
}

function plusMinutes(date: string, time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + minutes
  const day = addDays(date, Math.floor(total / 1440))
  const rest = total % 1440
  return `${day}T${String(Math.floor(rest / 60)).padStart(2, '0')}:${String(rest % 60).padStart(2, '0')}:00`
}

function timeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'UTC'
  }
}

export function eventBody(task: Task, remindMin: number) {
  const time = task.time ?? '09:00'
  const zone = timeZone()
  return {
    summary: task.done ? `✓ ${task.title}` : task.title,
    description: [task.note, 'Из приложения «1%»'].filter(Boolean).join('\n\n'),
    start: { dateTime: `${task.date}T${time}:00`, timeZone: zone },
    end: { dateTime: plusMinutes(task.date, time, 30), timeZone: zone },
    // Выполненное — серым и без напоминания, важное — оранжевым, остальное — зелёным
    colorId: task.done ? '8' : task.important ? '6' : '2',
    reminders: task.done
      ? { useDefault: false, overrides: [] }
      : { useDefault: false, overrides: [{ method: 'popup', minutes: remindMin }] },
    transparency: 'transparent',
    status: 'confirmed',
  }
}

/* ─────────────── Вход через Google ─────────────── */

type Token = { value: string; expiresAt: number }

function loadToken(): Token | null {
  try {
    const token = JSON.parse(read(TOKEN_KEY) ?? 'null') as Token | null
    return token && token.expiresAt > Date.now() + 60_000 ? token : null
  } catch {
    return null
  }
}

function redirectUri(): string {
  return window.location.origin + import.meta.env.BASE_URL
}

/** Уводит на страницу Google. silent — без вопросов, если доступ уже был выдан. */
export function startGoogleAuth(silent: boolean) {
  const state = crypto.randomUUID()
  try {
    sessionStorage.setItem(STATE_KEY, JSON.stringify({ state, silent }))
  } catch {
    // без sessionStorage ответ не примем: не сможем проверить, что он наш
  }
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: 'token',
    scope: SCOPE,
    include_granted_scopes: 'true',
    state,
    prompt: silent ? 'none' : 'consent',
  })
  window.location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`)
}

/**
 * Разбирает ответ Google после возвращения в приложение (#access_token=… в адресе).
 * Вызывается один раз при запуске, до отрисовки.
 */
export function handleGoogleRedirect() {
  const hash = window.location.hash.slice(1)
  if (!hash.includes('access_token=') && !hash.includes('error=')) return
  const params = new URLSearchParams(hash)
  let expected: { state: string; silent: boolean } | null = null
  try {
    expected = JSON.parse(sessionStorage.getItem(STATE_KEY) ?? 'null')
  } catch {
    expected = null
  }
  // Берём только свой ответ: по state, который сами отправили. Чужой (например, вход Supabase) не трогаем.
  if (!expected || params.get('state') !== expected.state) return
  try {
    sessionStorage.removeItem(STATE_KEY)
  } catch {
    // ничего страшного
  }
  history.replaceState(null, '', window.location.pathname + window.location.search)

  const token = params.get('access_token')
  if (token) {
    const expiresIn = Number(params.get('expires_in') ?? 3600)
    write(TOKEN_KEY, JSON.stringify({ value: token, expiresAt: Date.now() + expiresIn * 1000 }))
    write(ENABLED_KEY, '1')
    return
  }
  // Тихий вход не прошёл (нужно подтвердить заново) — спрашиваем явно
  if (expected?.silent && params.get('error') === 'interaction_required') startGoogleAuth(false)
}

/* ─────────────── Запросы к календарю ─────────────── */

class AuthError extends Error {}

async function call(token: string, url: string, init: RequestInit): Promise<Response> {
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
  if (response.status === 401) throw new AuthError('token expired')
  return response
}

async function upsertEvent(token: string, task: Task, remindMin: number) {
  const id = eventId(task.id)
  const body = JSON.stringify(eventBody(task, remindMin))
  const patched = await call(token, `${API}/${id}`, { method: 'PATCH', body })
  if (patched.ok) return
  if (patched.status !== 404) throw new Error(`calendar ${patched.status}`)
  const created = await call(token, API, { method: 'POST', body: JSON.stringify({ ...JSON.parse(body), id }) })
  if (!created.ok) throw new Error(`calendar ${created.status}`)
}

async function deleteEvent(token: string, taskId: string) {
  const response = await call(token, `${API}/${eventId(taskId)}`, { method: 'DELETE' })
  // 404 и 410 — события уже нет, это тоже успех
  if (!response.ok && response.status !== 404 && response.status !== 410) throw new Error(`calendar ${response.status}`)
}

/* ─────────────── Хук синхронизации ─────────────── */

export type CalendarStatus = 'off' | 'synced' | 'syncing' | 'needs-login' | 'error'

export function useCalendarSync(data: Data) {
  const configured = Boolean(GOOGLE_CLIENT_ID)
  const [enabled, setEnabled] = useState(() => configured && read(ENABLED_KEY) === '1')
  const [status, setStatus] = useState<CalendarStatus>(enabled ? 'syncing' : 'off')
  const [pending, setPending] = useState(0)
  const [count, setCount] = useState(() => Object.keys(loadSynced()).length)
  const running = useRef(false)
  const again = useRef(false)
  const dataRef = useRef(data)
  dataRef.current = data

  const run = useCallback(async () => {
    if (!enabled) return
    if (running.current) {
      again.current = true
      return
    }
    running.current = true
    try {
      do {
        again.current = false
        const synced = loadSynced()
        const remind = getRemindMin()
        const ops = planSync(dataRef.current, synced, todayKey(), remind)
        setPending(ops.length)
        if (ops.length === 0) {
          setStatus('synced')
          break
        }
        const token = loadToken()
        if (!token) {
          setStatus('needs-login')
          break
        }
        if (!navigator.onLine) {
          setStatus('error')
          break
        }
        setStatus('syncing')
        for (const op of ops) {
          if (op.kind === 'upsert') {
            await upsertEvent(token.value, op.task, remind)
            synced[op.task.id] = op.sig
          } else {
            await deleteEvent(token.value, op.taskId)
            delete synced[op.taskId]
          }
          saveSynced(synced)
          setPending(current => Math.max(0, current - 1))
        }
        setCount(Object.keys(synced).length)
        setStatus('synced')
      } while (again.current)
    } catch (error) {
      if (error instanceof AuthError) {
        write(TOKEN_KEY, null)
        setStatus('needs-login')
      } else {
        setStatus('error')
      }
    } finally {
      running.current = false
    }
  }, [enabled])

  // Любое изменение дел — через секунду отправляем в календарь
  useEffect(() => {
    if (!enabled) return
    const timer = window.setTimeout(() => void run(), 1000)
    return () => window.clearTimeout(timer)
  }, [data, enabled, run])

  // При возвращении в приложение и появлении сети — догоняем
  useEffect(() => {
    if (!enabled) return
    const wake = () => document.visibilityState === 'visible' && void run()
    window.addEventListener('online', wake)
    document.addEventListener('visibilitychange', wake)
    return () => {
      window.removeEventListener('online', wake)
      document.removeEventListener('visibilitychange', wake)
    }
  }, [enabled, run])

  const connect = useCallback(() => startGoogleAuth(false), [])
  const refresh = useCallback(() => startGoogleAuth(true), [])
  const disconnect = useCallback(() => {
    write(ENABLED_KEY, null)
    write(TOKEN_KEY, null)
    write(SYNCED_KEY, null)
    setEnabled(false)
    setStatus('off')
    setCount(0)
  }, [])

  /** После смены времени напоминания — пересобрать события. */
  const resync = useCallback(() => void run(), [run])

  return { configured, enabled, status, pending, count, connect, refresh, disconnect, resync }
}

export type CalendarSync = ReturnType<typeof useCalendarSync>

function loadSynced(): Record<string, string> {
  try {
    return JSON.parse(read(SYNCED_KEY) ?? '{}') as Record<string, string>
  } catch {
    return {}
  }
}

function saveSynced(synced: Record<string, string>) {
  write(SYNCED_KEY, JSON.stringify(synced))
}
