import { describe, expect, it } from 'vitest'
import { eventBody, eventId, planSync, taskSig } from './gcal'
import { goalTaskId, makeTask, type Data } from './model'

const TODAY = '2026-10-12'
const empty: Data = { tasks: {}, habits: {}, templates: {}, goals: {} }

function withTasks(...tasks: ReturnType<typeof makeTask>[]): Data {
  return { ...empty, tasks: Object.fromEntries(tasks.map(t => [t.id, t])) }
}

describe('planSync', () => {
  const walk = makeTask({ title: 'Прогулка', date: TODAY, time: '17:00' })

  it('отправляет в календарь только дела со временем, начиная со вчера', () => {
    const noTime = makeTask({ title: 'Без времени', date: TODAY })
    const old = makeTask({ title: 'Старое', date: '2026-10-01', time: '10:00' })
    const ops = planSync(withTasks(walk, noTime, old), {}, TODAY, 10)
    expect(ops).toEqual([{ kind: 'upsert', task: walk, sig: taskSig(walk, 10) }])
  })

  it('ничего не делает, если событие уже совпадает', () => {
    expect(planSync(withTasks(walk), { [walk.id]: taskSig(walk, 10) }, TODAY, 10)).toEqual([])
  })

  it('обновляет событие после отметки и после смены напоминания', () => {
    const synced = { [walk.id]: taskSig(walk, 10) }
    const done = { ...walk, done: true }
    expect(planSync(withTasks(done), synced, TODAY, 10)).toEqual([{ kind: 'upsert', task: done, sig: taskSig(done, 10) }])
    expect(planSync(withTasks(walk), synced, TODAY, 30)).toHaveLength(1)
  })

  it('удаляет событие, если дело удалили или убрали время', () => {
    const synced = { [walk.id]: taskSig(walk, 10) }
    expect(planSync(withTasks({ ...walk, deleted: true }), synced, TODAY, 10)).toEqual([{ kind: 'delete', taskId: walk.id }])
    expect(planSync(withTasks({ ...walk, time: null }), synced, TODAY, 10)).toEqual([{ kind: 'delete', taskId: walk.id }])
  })

  it('не трогает удалённое дело, которого не было в календаре', () => {
    expect(planSync(withTasks({ ...walk, deleted: true }), {}, TODAY, 10)).toEqual([])
  })
})

describe('eventId', () => {
  it('годится для Google: только a–v и 0–9, от 5 символов', () => {
    for (const id of [makeTask({ title: 'x', date: TODAY }).id, goalTaskId('abc', TODAY)]) {
      expect(eventId(id)).toMatch(/^[a-v0-9]{5,1024}$/)
    }
    expect(eventId('a')).not.toBe(eventId('b'))
  })
})

describe('eventBody', () => {
  it('открытое дело — с напоминанием, выполненное — с галочкой и без напоминания', () => {
    const task = makeTask({ title: 'Зал', date: TODAY, time: '23:50', important: true })
    const open = eventBody(task, 15)
    expect(open.summary).toBe('Зал')
    expect(open.start.dateTime).toBe('2026-10-12T23:50:00')
    expect(open.end.dateTime).toBe('2026-10-13T00:20:00')
    expect(open.reminders.overrides).toEqual([{ method: 'popup', minutes: 15 }])
    expect(open.colorId).toBe('6')

    const done = eventBody({ ...task, done: true }, 15)
    expect(done.summary).toBe('✓ Зал')
    expect(done.reminders.overrides).toEqual([])
    expect(done.colorId).toBe('8')
  })
})
