import type { Data } from './model'
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
