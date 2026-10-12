import type { CalendarEvent } from './calendar'
import type { Data, Task } from './model'
import { getRemindMin } from './calendar'
import type { Tab } from './ui'

export type Route =
  | { name: Tab }
  | { name: 'add' }
  | { name: 'detail'; taskId: string }
  | { name: 'goal'; goalId: string }
  | { name: 'goal-edit'; goalId?: string }
  | { name: 'template'; templateId?: string }

export type Go = (route: Route) => void
export type Change = (fn: (current: Data) => Data) => void

/** Что положить в календарь: показываем окно с выбором календаря. */
export type CalendarRequest = { title: string; fileName: string; events: CalendarEvent[] }
export type AskCalendar = (request: CalendarRequest) => void

export function taskEvent(task: Task): CalendarEvent {
  return {
    uid: task.id,
    title: task.title,
    date: task.date,
    time: task.time,
    description: task.note || undefined,
    remindMin: getRemindMin(),
  }
}
