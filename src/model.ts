import { addDays, fromKey, todayKey } from './dates'

export type Task = {
  id: string
  date: string
  title: string
  time: string | null
  tag: string | null
  important: boolean
  done: boolean
  doneAt: number | null
  note: string
  /** День, с которого дело перенесли, если его не успели сделать. */
  movedFrom: string | null
  /** Если дело — ежедневный шаг цели, здесь id цели. */
  goalId?: string
  createdAt: number
  updatedAt: number
  deleted?: boolean
}

export type Habit = {
  id: string
  title: string
  /** Дни, когда привычка выполнена: { "2026-10-12": true } */
  log: Record<string, boolean>
  createdAt: number
  updatedAt: number
  deleted?: boolean
}

export type TemplateItem = { title: string; time: string | null; tag: string | null }

export type Template = {
  id: string
  name: string
  items: TemplateItem[]
  updatedAt: number
  deleted?: boolean
}

export type Milestone = { id: string; title: string; done: boolean }

export type Goal = {
  id: string
  title: string
  /** Ежедневный шаг, например «Урок Tilda 30 минут». */
  step: string
  /** Время шага «19:00» или null. */
  time: string | null
  /** Дни недели для шага: 0 — воскресенье … 6 — суббота. */
  weekdays: number[]
  start: string
  deadline: string
  milestones: Milestone[]
  createdAt: number
  updatedAt: number
  deleted?: boolean
}

export type Data = {
  tasks: Record<string, Task>
  habits: Record<string, Habit>
  templates: Record<string, Template>
  goals: Record<string, Goal>
}

type Item = { updatedAt: number }

export function newId(): string {
  return crypto.randomUUID()
}

/**
 * Склеивает данные с двух устройств: по каждой записи побеждает та версия,
 * которую меняли позже. Удалённые записи помечаются, а не стираются,
 * чтобы удаление тоже доехало до другого устройства.
 */
export function merge(a: Data, b: Data): Data {
  const pick = <T extends Item>(x: Record<string, T>, y: Record<string, T>) => {
    const out: Record<string, T> = { ...x }
    for (const [id, item] of Object.entries(y)) {
      if (!out[id] || item.updatedAt > out[id].updatedAt) out[id] = item
    }
    return out
  }
  return {
    tasks: pick(a.tasks, b.tasks),
    habits: pick(a.habits, b.habits),
    templates: pick(a.templates, b.templates),
    goals: pick(a.goals ?? {}, b.goals ?? {}),
  }
}

/** Данные, сохранённые старой версией приложения, дополняем новыми разделами. */
export function normalize(data: Partial<Data>): Data {
  return {
    tasks: data.tasks ?? {},
    habits: data.habits ?? {},
    templates: data.templates ?? {},
    goals: data.goals ?? {},
  }
}

/** Невыполненные дела из прошлых дней переезжают на сегодня. */
export function rollOver(data: Data, today = todayKey()): Data {
  let changed = false
  const tasks = { ...data.tasks }
  for (const task of Object.values(tasks)) {
    // Шаги целей не переносим: пропущенный день — это пропуск, а не долг.
    if (!task.deleted && !task.done && !task.goalId && task.date < today) {
      tasks[task.id] = { ...task, date: today, movedFrom: task.movedFrom ?? task.date, updatedAt: Date.now() }
      changed = true
    }
  }
  return changed ? { ...data, tasks } : data
}

export function makeTask(fields: Partial<Task> & { title: string; date: string }): Task {
  const now = Date.now()
  return {
    id: newId(),
    time: null,
    tag: null,
    important: false,
    done: false,
    doneAt: null,
    note: '',
    movedFrom: null,
    createdAt: now,
    updatedAt: now,
    ...fields,
  }
}

export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.time && b.time) return a.time.localeCompare(b.time)
    if (a.time) return -1
    if (b.time) return 1
    return a.createdAt - b.createdAt
  })
}

export function liveTasks(data: Data, date: string): Task[] {
  return sortTasks(Object.values(data.tasks).filter(t => !t.deleted && t.date === date))
}

/** Сколько дней подряд привычка выполнена, считая сегодня (или вчера, если сегодня ещё не отмечена). */
export function habitStreak(habit: Habit, today = todayKey()): number {
  let day = habit.log[today] ? today : addDays(today, -1)
  let streak = 0
  while (habit.log[day]) {
    streak += 1
    day = addDays(day, -1)
  }
  return streak
}

/** Серия дней подряд, когда сделано хотя бы одно дело. */
export function dayStreak(data: Data, today = todayKey()): number {
  const doneDays = new Set(
    Object.values(data.tasks).filter(t => !t.deleted && t.done).map(t => t.date),
  )
  let day = doneDays.has(today) ? today : addDays(today, -1)
  let streak = 0
  while (doneDays.has(day)) {
    streak += 1
    day = addDays(day, -1)
  }
  return streak
}

export function emptyData(): Data {
  const now = Date.now()
  const templates: Template[] = [
    {
      id: newId(),
      name: 'Мой обычный день',
      updatedAt: now,
      items: [
        { title: 'Разминка', time: '08:00', tag: 'спорт' },
        { title: 'Час Figma', time: '10:00', tag: 'учёба' },
        { title: '30 минут нейросетей', time: '12:00', tag: 'учёба' },
        { title: 'Прогулка', time: '17:00', tag: 'спорт' },
        { title: 'Отдых без экрана', time: '20:00', tag: 'я' },
      ],
    },
    {
      id: newId(),
      name: 'День тренировки',
      updatedAt: now,
      items: [
        { title: 'Завтрак с белком', time: '08:30', tag: 'еда' },
        { title: 'Тренировка в зале', time: '11:00', tag: 'спорт' },
        { title: 'Растяжка', time: '12:30', tag: 'спорт' },
        { title: 'Лечь спать до 23:00', time: '22:30', tag: 'я' },
      ],
    },
  ]
  const habits: Habit[] = [
    { id: newId(), title: 'Выпить 2 литра воды', log: {}, createdAt: now, updatedAt: now },
    { id: newId(), title: 'Учиться 1 час', log: {}, createdAt: now + 1, updatedAt: now },
  ]
  return {
    tasks: {},
    habits: Object.fromEntries(habits.map(h => [h.id, h])),
    templates: Object.fromEntries(templates.map(t => [t.id, t])),
    goals: {},
  }
}

/* ─────────────── Цели ─────────────── */

export function liveGoals(data: Data): Goal[] {
  return Object.values(data.goals).filter(g => !g.deleted).sort((a, b) => a.deadline.localeCompare(b.deadline))
}

export function isStepDay(goal: Goal, date: string): boolean {
  return date >= goal.start && date <= goal.deadline && goal.weekdays.includes(fromKey(date).getDay())
}

/** Сколько дней с шагом между двумя датами включительно. */
export function countStepDays(goal: Goal, from: string, to: string): number {
  let count = 0
  for (let day = from; day <= to; day = addDays(day, 1)) {
    if (isStepDay(goal, day)) count += 1
  }
  return count
}

/** У шага цели на конкретный день постоянный id — так он не задвоится на двух устройствах. */
export function goalTaskId(goalId: string, date: string): string {
  return `goal-${goalId}-${date}`
}

/**
 * Кладёт в день шаги активных целей. Если шаг уже есть (или его удалили вручную) — не трогаем,
 * но обновляем название и время у невыполненного, если цель отредактировали.
 */
export function ensureGoalTasks(data: Data, date = todayKey()): Data {
  let tasks: Record<string, Task> | null = null
  for (const goal of liveGoals(data)) {
    const id = goalTaskId(goal.id, date)
    const existing = data.tasks[id]
    if (!isStepDay(goal, date)) {
      // День убрали из расписания цели — невыполненный шаг больше не нужен
      if (existing && !existing.done && !existing.deleted) {
        tasks ??= { ...data.tasks }
        tasks[id] = { ...existing, deleted: true, updatedAt: Date.now() }
      }
      continue
    }
    if (!existing) {
      tasks ??= { ...data.tasks }
      tasks[id] = { ...makeTask({ title: goal.step, date, time: goal.time, tag: 'цель', goalId: goal.id }), id }
    } else if (!existing.deleted && !existing.done && (existing.title !== goal.step || existing.time !== goal.time)) {
      tasks ??= { ...data.tasks }
      tasks[id] = { ...existing, title: goal.step, time: goal.time, updatedAt: Date.now() }
    }
  }
  return tasks ? { ...data, tasks } : data
}

/** Шаги целей на неделю вперёд: так напоминания в календаре стоят заранее. */
export const GOAL_DAYS_AHEAD = 7

export function ensureGoalWeek(data: Data, today = todayKey()): Data {
  let next = data
  for (let i = 0; i < GOAL_DAYS_AHEAD; i += 1) next = ensureGoalTasks(next, addDays(today, i))
  return next
}

export type GoalProgress = {
  /** Сделано шагов. */
  done: number
  /** Всего шагов по плану от старта до дедлайна. */
  planned: number
  /** Процент выполнения цели, 0–100. */
  percent: number
  /** Сколько шагов должно быть сделано к сегодняшнему дню. */
  expected: number
  /** Сделано минус ожидаемое: плюс — опережаешь, минус — отстаёшь. */
  pace: number
  daysLeft: number
  isFinished: boolean
}

export function goalProgress(data: Data, goal: Goal, today = todayKey()): GoalProgress {
  const doneDays = new Set(
    Object.values(data.tasks)
      .filter(t => t.goalId === goal.id && t.done && !t.deleted)
      .map(t => t.date),
  )
  const done = doneDays.size
  const planned = Math.max(1, countStepDays(goal, goal.start, goal.deadline))
  // Сегодняшний шаг идёт в план, только если он уже сделан: день ещё не закончился.
  const end = today > goal.deadline ? goal.deadline : addDays(today, -1)
  let expected = end >= goal.start ? countStepDays(goal, goal.start, end) : 0
  if (today <= goal.deadline && doneDays.has(today)) expected += 1
  const msPerDay = 24 * 60 * 60 * 1000
  const daysLeft = Math.max(0, Math.round((fromKey(goal.deadline).getTime() - fromKey(today).getTime()) / msPerDay))
  return {
    done,
    planned,
    percent: Math.min(100, Math.round((done / planned) * 100)),
    expected,
    pace: done - expected,
    daysLeft,
    isFinished: today > goal.deadline,
  }
}
