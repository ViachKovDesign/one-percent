import { useEffect, useMemo, useState } from 'react'
import {
  addDays, formatChip, formatLong, formatRange, formatRelative, fromKey, plural,
  todayKey, WEEKDAYS_SHORT, weekStart,
} from './dates'
import {
  dayStreak, goalProgress, habitStreak, liveGoals, liveTasks, makeTask, newId,
  type Data, type Habit, type Task, type Template,
} from './model'
import { CalendarBanner, CalendarNote } from './calendarUi'
import { getRemindMin, setRemindMin, useCalendarSync, type CalendarSync } from './gcal'
import { GoalEditScreen, GoalScreen, GoalsScreen } from './goals'
import type { Change, Route } from './nav'
import { parseQuick } from './parse'
import { DateChips, TimeChips } from './pickers'
import { useStore, type SyncStatus } from './store'
import { TemplateEditScreen } from './templates'
import {
  Action, BottomNav, Checkbox, Icon, Leaf, ProgressBar, ProgressRing, ScreenHeader, TagChip,
} from './ui'


type Toast = { id: number; text: string; action?: { label: string; run: () => void } }
type Notify = (text: string, action?: Toast['action']) => void

function greeting(): string {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return 'Доброе утро'
  if (hour >= 12 && hour < 17) return 'Добрый день'
  if (hour >= 17 && hour < 23) return 'Добрый вечер'
  return 'Доброй ночи'
}

function updateTask(change: Change, id: string, fields: Partial<Task>) {
  change(data => ({
    ...data,
    tasks: { ...data.tasks, [id]: { ...data.tasks[id], ...fields, updatedAt: Date.now() } },
  }))
}

function toggleTask(change: Change, task: Task) {
  // Берём свежую версию: два быстрых нажатия подряд дают «отметил — снял», а не одно и то же дважды
  change(data => {
    const fresh = data.tasks[task.id] ?? task
    return {
      ...data,
      tasks: {
        ...data.tasks,
        [task.id]: { ...fresh, done: !fresh.done, doneAt: fresh.done ? null : Date.now(), updatedAt: Date.now() },
      },
    }
  })
}

function applyTemplate(change: Change, template: Template, date: string) {
  change(data => {
    const tasks = { ...data.tasks }
    for (const item of template.items) {
      const task = makeTask({ ...item, date })
      tasks[task.id] = task
    }
    return { ...data, tasks }
  })
}

function liveTemplates(data: Data): Template[] {
  return Object.values(data.templates).filter(t => !t.deleted).sort((a, b) => a.name.localeCompare(b.name, 'ru'))
}

/* ─────────────── День ─────────────── */

function TaskCard({ task, onToggle, onOpen }: { task: Task; onToggle: () => void; onOpen: () => void }) {
  return (
    <div className={`task-card ${task.done ? 'task-done' : ''} ${task.important ? 'task-accent' : ''}`}>
      <Checkbox done={task.done} onClick={onToggle} />
      <Action className="task-content" onClick={onOpen} label={`Открыть: ${task.title}`}>
        <div className="task-title">{task.title}</div>
        <div className="task-meta">
          {task.time && <span>{task.time}</span>}
          {task.tag && <TagChip warm={task.important}>{task.tag}</TagChip>}
          {!task.tag && task.important && <TagChip warm>важно</TagChip>}
          {task.movedFrom && !task.done && <span className="moved">перенесено</span>}
        </div>
      </Action>
      <Icon name="chevron" size="sm" />
    </div>
  )
}

function progressTitle(done: number, total: number): [string, string] {
  if (total === 0) return ['Чистый лист', 'Запиши одно дело и сделай шаг.']
  if (done === 0) return ['Начни с малого', 'Одно дело — и ты уже на 1% лучше.']
  if (done === total) return ['День закрыт!', 'Ты стал лучше, чем вчера.']
  if (done / total < 0.5) return ['Хорошее начало', 'Пара побед уже есть.']
  return ['Ты растёшь', 'Осталось совсем немного.']
}

function TodayScreen({
  data, change, date, setDate, go, name, calendar,
}: {
  data: Data
  change: Change
  date: string
  setDate: (date: string) => void
  go: (route: Route) => void
  name: string | null
  calendar: CalendarSync
}) {
  const today = todayKey()
  const tasks = liveTasks(data, date)
  const done = tasks.filter(t => t.done).length
  const [title, subtitle] = progressTitle(done, tasks.length)
  const templates = liveTemplates(data)
  const goals = liveGoals(data)

  return (
    <>
      <main className="screen today-screen">
        <CalendarBanner calendar={calendar} />
        <div className="top-row">
          <div>
            <div className="eyebrow">{formatLong(date)}</div>
            <div className="hero-title">{date === today ? `${greeting()}${name ? `, ${name}` : ''}` : formatRelative(date)}</div>
            <div className="subtitle">Стань лучше на 1% сегодня.</div>
          </div>
          <div className="avatar">{name ? name[0] : '1%'}</div>
        </div>

        <div className="day-switch">
          <Action className="icon-action small" onClick={() => setDate(addDays(date, -1))} label="Предыдущий день">
            <Icon name="arrow" size="sm" />
          </Action>
          <Action className={`day-switch-label ${date === today ? 'is-today' : ''}`} onClick={() => setDate(today)}>
            {date === today ? 'Сегодня' : 'Вернуться к сегодня'}
          </Action>
          <Action className="icon-action small flip" onClick={() => setDate(addDays(date, 1))} label="Следующий день">
            <Icon name="arrow" size="sm" />
          </Action>
        </div>

        <section className="progress-card">
          <div className="progress-text">
            <TagChip>ритм дня</TagChip>
            <div className="section-title">{title}</div>
            <div className="muted-copy">{subtitle}</div>
          </div>
          <ProgressRing done={done} total={tasks.length} />
        </section>

        {goals.length > 0 && (
          <div className="goal-strip">
            {goals.map(goal => {
              const p = goalProgress(data, goal, today)
              return (
                <Action key={goal.id} className="goal-pill" onClick={() => go({ name: 'goal', goalId: goal.id })}>
                  <span className="goal-pill-title">{goal.title}</span>
                  <ProgressBar percent={p.percent} />
                  <span className="goal-pill-percent">{p.percent}%</span>
                </Action>
              )
            })}
          </div>
        )}

        <div className="section-heading">
          <div className="section-title">Твой день</div>
          <span className="count-label">
            {tasks.length} {plural(tasks.length, ['дело', 'дела', 'дел'])}
          </span>
        </div>

        {tasks.length > 0 && (
          <div className="task-list">
            {tasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                onToggle={() => toggleTask(change, task)}
                onOpen={() => go({ name: 'detail', taskId: task.id })}
              />
            ))}
          </div>
        )}
        {tasks.every(task => task.goalId) && (
          <div className="empty-card">
            <div className="muted-copy">
              {tasks.length === 0 ? 'Пусто.' : 'Своих дел пока нет.'} Добавь дело кнопкой «+» или начни с шаблона:
            </div>
            <div className="chip-row">
              {templates.map(template => (
                <Action key={template.id} className="suggestion-chip" onClick={() => applyTemplate(change, template, date)}>
                  <Icon name="layers" size="sm" /> {template.name}
                </Action>
              ))}
            </div>
          </div>
        )}
      </main>
      <Action className="fab" onClick={() => go({ name: 'add' })} label="Добавить дело">
        <Icon name="plus" size="lg" />
      </Action>
      <BottomNav tab="today" navigate={tab => go({ name: tab })} />
    </>
  )
}

/* ─────────────── Добавить ─────────────── */

function AddScreen({
  data, change, date, go, notify,
}: {
  data: Data
  change: Change
  date: string
  go: (route: Route) => void
  notify: Notify
}) {
  const [text, setText] = useState('')
  const [important, setImportant] = useState(false)
  // Выбор на плашках главнее того, что понято из текста
  const [pickedDate, setPickedDate] = useState<string | null>(null)
  const [pickedTime, setPickedTime] = useState<string | null | undefined>(undefined)
  const today = todayKey()
  const parsed = parseQuick(text, today)
  const target = pickedDate ?? parsed.date ?? date
  const time = pickedTime !== undefined ? pickedTime : parsed.time
  const isImportant = important || parsed.important
  const templates = liveTemplates(data)

  const save = () => {
    if (!parsed.title) return
    const task = makeTask({
      title: parsed.title,
      date: target,
      time,
      tag: parsed.tag,
      important: isImportant,
    })
    change(current => ({ ...current, tasks: { ...current.tasks, [task.id]: task } }))
    if (target !== date) notify(`Добавлено: ${formatRelative(target).toLowerCase()}${time ? `, ${time}` : ''}`)
    go({ name: 'today' })
  }

  return (
    <main className="screen add-screen">
      <ScreenHeader eyebrow="Новая умная заметка" title="Запиши мысль" onBack={() => go({ name: 'today' })} />
      <textarea
        className="note-input"
        autoFocus
        rows={4}
        value={text}
        placeholder="Что нужно сделать?"
        aria-label="Что нужно сделать?"
        onChange={event => setText(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            save()
          }
        }}
      />

      <div className="recognition-card">
        <div className="recognition-icon">
          <Icon name="sparkle" size="sm" />
        </div>
        <div>
          <div className="recognition-label">1% понимает тебя</div>
          <div className="recognition-example">«завтра в 10:00 зал #спорт !»</div>
          <div className="recognition-result">
            <Icon name="arrow" size="sm" /> дата · время · тег · важно
          </div>
        </div>
      </div>

      <div className="suggestion-group">
        <div className="group-label">Дата</div>
        <DateChips value={target} onChange={setPickedDate} />
      </div>

      <div className="suggestion-group compact">
        <div className="group-label">Время</div>
        <TimeChips value={time} onChange={setPickedTime} />
      </div>

      <div className="suggestion-group compact">
        <div className="group-label">Метки</div>
        <div className="chip-row">
          {parsed.tag && (
            <span className="suggestion-chip selected">
              <Icon name="tag" size="sm" /> {parsed.tag}
            </span>
          )}
          <Action
            className={`suggestion-chip ${isImportant ? 'warm' : ''}`}
            onClick={() => setImportant(!important)}
            disabled={parsed.important}
          >
            <Icon name="flag" size="sm" /> Важно
          </Action>
          {!parsed.tag && <span className="chip-hint">тег — через #, например #спорт</span>}
        </div>
      </div>

      {templates.length > 0 && (
        <div className="suggestion-group">
          <div className="group-label">Или добавь шаблон на {formatChip(target, today).toLowerCase()}</div>
          <div className="chip-row">
            {templates.map(template => (
              <Action
                key={template.id}
                className="suggestion-chip"
                onClick={() => {
                  applyTemplate(change, template, target)
                  go({ name: 'today' })
                }}
              >
                <Icon name="layers" size="sm" /> {template.name} · {template.items.length}
              </Action>
            ))}
          </div>
        </div>
      )}

      <div className="add-tip">
        <Leaf small />
        <span>Пиши как думаешь. 1% разложит всё по местам.</span>
      </div>

      <div className="bottom-actions">
        <Action className="secondary-button" onClick={() => go({ name: 'today' })}>Отмена</Action>
        <Action className="primary-button" onClick={save} disabled={!parsed.title}>
          Добавить в день <Icon name="plus" size="sm" />
        </Action>
      </div>
    </main>
  )
}

/* ─────────────── Дело ─────────────── */

function DetailScreen({
  data, change, taskId, go, calendar, notify,
}: {
  data: Data
  change: Change
  taskId: string
  go: (route: Route) => void
  calendar: CalendarSync
  notify: Notify
}) {
  const task = data.tasks[taskId]
  if (!task || task.deleted) {
    return (
      <main className="screen">
        <ScreenHeader title="Дело не найдено" onBack={() => go({ name: 'today' })} />
      </main>
    )
  }
  const update = (fields: Partial<Task>) => updateTask(change, task.id, fields)
  const today = todayKey()

  return (
    <main className="screen detail-screen">
      <ScreenHeader eyebrow="Подробности" title={formatRelative(task.date)} onBack={() => go({ name: 'today' })} />
      <input
        className="detail-title"
        value={task.title}
        aria-label="Название"
        onChange={event => update({ title: event.target.value })}
        onBlur={event => !event.target.value.trim() && update({ title: 'Без названия' })}
      />
      <div className="detail-tags">
        {task.tag && <TagChip>{task.tag}</TagChip>}
        <TagChip warm>
          {formatChip(task.date, today)}
          {task.time ? ` · ${task.time}` : ''}
        </TagChip>
        <Action className={`tag-chip toggle ${task.important ? 'tag-warm' : ''}`} onClick={() => update({ important: !task.important })}>
          {task.important ? 'важно ✓' : 'сделать важным'}
        </Action>
      </div>

      <section className="detail-section">
        <div className="group-label">Дата</div>
        <DateChips value={task.date} onChange={value => update({ date: value })} />
      </section>

      <section className="detail-section compact">
        <div className="group-label">Время</div>
        <TimeChips value={task.time} onChange={value => update({ time: value })} />
      </section>

      <section className="detail-section">
        <div className="group-label">Заметки</div>
        <textarea
          className="notes-card"
          rows={4}
          placeholder="Мысли, ссылки, что получилось…"
          value={task.note}
          onChange={event => update({ note: event.target.value })}
        />
      </section>

      <section className="detail-section">
        <div className="group-label">Напоминание</div>
        <CalendarNote calendar={calendar} hasTime={task.time !== null} go={go} />
      </section>

      <section className="detail-section">
        <div className="group-label">История</div>
        <div className="history-card">
          <div className="history-dot" />
          <div>
            <div className="recognition-label">
              {task.done && task.doneAt
                ? `Сделано ${new Date(task.doneAt).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}`
                : `Создано ${new Date(task.createdAt).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}`}
            </div>
            {task.movedFrom && <div className="muted-copy">Перенесено с {formatChip(task.movedFrom, today).toLowerCase()}</div>}
          </div>
        </div>
      </section>

      <div className="bottom-actions">
        <Action
          className="secondary-button square"
          label="Удалить"
          onClick={() => {
            update({ deleted: true })
            notify(`Удалено: ${task.title}`, { label: 'Вернуть', run: () => update({ deleted: false }) })
            go({ name: 'today' })
          }}
        >
          <Icon name="trash" />
        </Action>
        <Action
          className="primary-button grow"
          onClick={() => {
            toggleTask(change, task)
            go({ name: 'today' })
          }}
        >
          <Icon name="check" /> {task.done ? 'Вернуть в работу' : 'Готово'}
        </Action>
      </div>
    </main>
  )
}

/* ─────────────── Привычки ─────────────── */

function HabitsScreen({ data, change, go }: { data: Data; change: Change; go: (route: Route) => void }) {
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)
  const today = todayKey()
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6))
  const habits = Object.values(data.habits).filter(h => !h.deleted).sort((a, b) => a.createdAt - b.createdAt)
  const doneToday = habits.filter(h => h.log[today]).length

  // Меняем всегда свежую версию привычки: быстрые нажатия подряд не теряются
  const setHabit = (habit: Habit, fn: (current: Habit) => Partial<Habit>) =>
    change(current => {
      const fresh = current.habits[habit.id] ?? habit
      return { ...current, habits: { ...current.habits, [habit.id]: { ...fresh, ...fn(fresh), updatedAt: Date.now() } } }
    })

  const toggleDay = (habit: Habit, day: string) =>
    setHabit(habit, fresh => {
      const log = { ...fresh.log }
      if (log[day]) delete log[day]
      else log[day] = true
      return { log }
    })

  const add = () => {
    const title = draft.trim()
    if (!title) return
    const now = Date.now()
    const habit: Habit = { id: newId(), title, log: {}, createdAt: now, updatedAt: now }
    change(current => ({ ...current, habits: { ...current.habits, [habit.id]: habit } }))
    setDraft('')
  }

  return (
    <>
      <main className="screen">
        <ScreenHeader eyebrow={formatLong(today)} title="Привычки" />
        <div className="timeline-summary">
          <div className="timeline-summary-icon"><Icon name="repeat" /></div>
          <div>
            <div className="summary-value">
              {habits.length === 0 ? 'Заведи первую привычку' : `${doneToday} из ${habits.length} сегодня`}
            </div>
            <div className="muted-copy">Маленькие шаги каждый день дают большой рост.</div>
          </div>
          {habits.length > 0 && (
            <Action className="text-button" onClick={() => setEditing(!editing)}>
              {editing ? 'Готово' : 'Изменить'}
            </Action>
          )}
        </div>

        <div className="habit-list">
          {habits.map(habit => {
            const streak = habitStreak(habit, today)
            return (
              <div className="habit-card" key={habit.id}>
                <div className="habit-top">
                  <Checkbox done={Boolean(habit.log[today])} onClick={() => toggleDay(habit, today)} />
                  <div className="habit-text">
                    <div className="task-title">{habit.title}</div>
                    <div className="timeline-note">
                      {streak > 0 ? `🔥 ${streak} ${plural(streak, ['день', 'дня', 'дней'])} подряд` : 'Начни серию сегодня'}
                    </div>
                  </div>
                  {editing && (
                    <Action className="icon-action small danger" label="Удалить привычку" onClick={() => setHabit(habit, () => ({ deleted: true }))}>
                      <Icon name="trash" size="sm" />
                    </Action>
                  )}
                </div>
                <div className="habit-days">
                  {days.map(day => (
                    <Action
                      key={day}
                      className={`habit-day ${habit.log[day] ? 'on' : ''} ${day === today ? 'today' : ''}`}
                      onClick={() => toggleDay(habit, day)}
                      label={formatChip(day, today)}
                    >
                      <span>{WEEKDAYS_SHORT[(fromKey(day).getDay() + 6) % 7]}</span>
                      <i />
                    </Action>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <div className="add-row">
          <input
            className="add-input"
            value={draft}
            placeholder="Новая привычка, например «10 отжиманий»"
            onChange={event => setDraft(event.target.value)}
            onKeyDown={event => event.key === 'Enter' && add()}
          />
          <Action className="icon-action dark" onClick={add} label="Добавить привычку" disabled={!draft.trim()}>
            <Icon name="plus" />
          </Action>
        </div>
      </main>
      <BottomNav tab="habits" navigate={tab => go({ name: tab })} />
    </>
  )
}

/* ─────────────── Неделя ─────────────── */

function WeekScreen({
  data, setDate, go,
}: {
  data: Data
  setDate: (date: string) => void
  go: (route: Route) => void
}) {
  const today = todayKey()
  const [start, setStart] = useState(() => weekStart(today))
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  const stats = days.map(day => {
    const tasks = liveTasks(data, day)
    const done = tasks.filter(t => t.done).length
    return { day, total: tasks.length, done, progress: tasks.length ? Math.round((done / tasks.length) * 100) : 0 }
  })
  const total = stats.reduce((sum, s) => sum + s.total, 0)
  const done = stats.reduce((sum, s) => sum + s.done, 0)
  const percent = total ? Math.round((done / total) * 100) : 0
  const best = stats.filter(s => s.done > 0).sort((a, b) => b.done - a.done || b.progress - a.progress)[0]
  const streak = dayStreak(data, today)

  return (
    <>
      <main className="screen">
        <ScreenHeader eyebrow={formatRange(days[0], days[6])} title="Неделя роста" />
        <div className="week-nav">
          <Action className="icon-action small" onClick={() => setStart(addDays(start, -7))} label="Прошлая неделя">
            <Icon name="arrow" size="sm" />
          </Action>
          <Action className="day-switch-label" onClick={() => setStart(weekStart(today))}>
            {start === weekStart(today) ? 'Эта неделя' : 'К этой неделе'}
          </Action>
          <Action className="icon-action small flip" onClick={() => setStart(addDays(start, 7))} label="Следующая неделя">
            <Icon name="arrow" size="sm" />
          </Action>
        </div>
        <div className="week-strip">
          {stats.map((item, index) => (
            <Action
              className={`day-cell ${item.day === today ? 'active' : ''}`}
              key={item.day}
              onClick={() => {
                setDate(item.day)
                go({ name: 'today' })
              }}
              label={formatLong(item.day)}
            >
              <span className="day-name">{WEEKDAYS_SHORT[index]}</span>
              <div className="day-leaf" style={{ '--fill': `${item.progress}%` } as React.CSSProperties}>
                <Leaf small />
                {item.progress > 0 && <span className="leaf-fill" />}
              </div>
              <span className="day-date">{fromKey(item.day).getDate()}</span>
            </Action>
          ))}
        </div>

        <section className="week-hero">
          <div className="week-art">
            <div className="plant-stem" />
            <Leaf />
            <div className="plant-leaf-two"><Leaf small /></div>
          </div>
          <div className="week-hero-copy">
            <TagChip>твоя неделя</TagChip>
            <div className="section-title">
              Понемногу,<br />но каждый день
            </div>
            <div className="muted-copy">
              {total ? `Выполнено ${percent}% от запланированного.` : 'На эту неделю пока ничего не запланировано.'}
            </div>
          </div>
        </section>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon peach"><Icon name="repeat" /></div>
            <div className="stat-value">
              {streak} {plural(streak, ['день', 'дня', 'дней'])}
            </div>
            <div className="stat-label">Серия подряд</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon"><Icon name="check" /></div>
            <div className="stat-value">{done}</div>
            <div className="stat-label">Сделано за неделю</div>
          </div>
        </div>
        {best && (
          <div className="best-day-card">
            <div className="best-day-badge">{WEEKDAYS_SHORT[(fromKey(best.day).getDay() + 6) % 7].toUpperCase()}</div>
            <div>
              <div className="recognition-label">Лучший день: {formatChip(best.day, today).toLowerCase()}</div>
              <div className="muted-copy">
                Сделано {best.done} из {best.total}.
              </div>
            </div>
            <Icon name="sparkle" />
          </div>
        )}
      </main>
      <BottomNav tab="week" navigate={tab => go({ name: tab })} />
    </>
  )
}

/* ─────────────── Профиль ─────────────── */

const STATUS_TEXT: Record<SyncStatus, string> = {
  local: 'Данные хранятся только на этом устройстве',
  syncing: 'Синхронизация…',
  synced: 'Всё сохранено в облаке',
  offline: 'Нет сети — сохраню, когда появится',
  error: 'Не получилось синхронизировать, попробую ещё раз',
}

const CALENDAR_STATUS: Record<CalendarSync['status'], string> = {
  off: 'Выключен',
  synced: 'Всё в календаре',
  syncing: 'Обновляю календарь…',
  'needs-login': 'Google просит войти заново — нажми «Обновить доступ»',
  error: 'Нет связи с календарём, попробую ещё раз',
}

function ProfileScreen({
  data, change, date, go, store, name, calendar,
}: {
  data: Data
  change: Change
  date: string
  go: (route: Route) => void
  store: ReturnType<typeof useStore>
  name: string | null
  calendar: CalendarSync
}) {
  const templates = liveTemplates(data)
  const growingDays = useMemo(
    () => new Set(Object.values(data.tasks).filter(t => !t.deleted && t.done).map(t => t.date)).size,
    [data.tasks],
  )
  const dayTasks = liveTasks(data, date)

  const saveDayAsTemplate = () => {
    // Создаём шаблон и сразу открываем редактор — там можно переименовать и поправить дела
    const template: Template = {
      id: newId(),
      name: `Мой день · ${formatChip(date).toLowerCase()}`,
      updatedAt: Date.now(),
      items: dayTasks.map(t => ({ title: t.title, time: t.time, tag: t.tag })),
    }
    change(current => ({ ...current, templates: { ...current.templates, [template.id]: template } }))
    go({ name: 'template', templateId: template.id })
  }

  const [remind, setRemind] = useState(getRemindMin)

  return (
    <>
      <main className="screen profile-screen">
        <div className="profile-avatar">{name ? name[0] : '1%'}</div>
        <div className="hero-title">{name ? `1% · ${name}` : 'Мой 1%'}</div>
        <div className="subtitle">Каждый день немного лучше.</div>

        <div className="profile-card">
          <Leaf />
          <div className="section-title">
            {growingDays} {plural(growingDays, ['день', 'дня', 'дней'])} роста
          </div>
          <div className="muted-copy">Дни, когда ты сделал хотя бы одно дело.</div>
        </div>

        <section className="profile-section">
          <div className="group-label">Google Календарь</div>
          <div className="settings-card">
            {!calendar.configured ? (
              <div className="muted-copy">
                Синхронизация с календарём заработает после настройки доступа Google (один раз, инструкция в README).
              </div>
            ) : !calendar.enabled ? (
              <>
                <div className="muted-copy">
                  Дела со временем и шаги целей появятся в твоём календаре с напоминанием. Отметил «готово» — событие
                  станет «✓» и без напоминания, удалил — исчезнет из календаря.
                </div>
                <Action className="primary-button google" onClick={calendar.connect}>
                  <Icon name="calendar" size="sm" /> Подключить Google Календарь
                </Action>
              </>
            ) : (
              <>
                <div className="recognition-label">Календарь подключён</div>
                <div className={`muted-copy status-${calendar.status === 'synced' ? 'synced' : calendar.status === 'error' ? 'error' : 'local'}`}>
                  {CALENDAR_STATUS[calendar.status]}
                  {calendar.status === 'synced' ? ` · ${calendar.count} ${plural(calendar.count, ['событие', 'события', 'событий'])}` : ''}
                </div>
                <div className="muted-copy calendar-hint">За сколько минут напоминать:</div>
                <div className="chip-row">
                  {[5, 10, 15, 30, 60].map(minutes => (
                    <Action
                      key={minutes}
                      className={`suggestion-chip ${remind === minutes ? 'selected' : ''}`}
                      onClick={() => {
                        setRemindMin(minutes)
                        setRemind(minutes)
                        calendar.resync()
                      }}
                    >
                      {minutes === 60 ? '1 час' : `${minutes} мин`}
                    </Action>
                  ))}
                </div>
                <div className="chip-row">
                  {calendar.status === 'needs-login' && (
                    <Action className="suggestion-chip selected" onClick={calendar.refresh}>
                      <Icon name="repeat" size="sm" /> Обновить доступ
                    </Action>
                  )}
                  <Action
                    className="suggestion-chip"
                    onClick={() => window.confirm('Отключить календарь? События, которые уже там, останутся.') && calendar.disconnect()}
                  >
                    Отключить
                  </Action>
                </div>
              </>
            )}
          </div>
        </section>

        <section className="profile-section">
          <div className="group-label">Дела на всех устройствах</div>
          <div className="settings-card">
            {!store.canSync ? (
              <div className="muted-copy">
                Пока дела хранятся на этом устройстве. Общий список на телефоне и компьютере появится после подключения
                базы (Supabase) — это отдельный шаг.
              </div>
            ) : store.session ? (
              <>
                <div className="recognition-label">{store.session.user.email}</div>
                <div className={`muted-copy status-${store.status}`}>{STATUS_TEXT[store.status]}</div>
                <div className="chip-row">
                  <Action className="suggestion-chip" onClick={() => void store.sync()}>
                    <Icon name="repeat" size="sm" /> Синхронизировать
                  </Action>
                  <Action className="suggestion-chip" onClick={() => void store.signOut()}>Выйти</Action>
                </div>
              </>
            ) : (
              <>
                <div className="muted-copy">Войди, чтобы дела были на всех твоих устройствах.</div>
                <Action className="primary-button google" onClick={() => void store.signIn()}>
                  Войти через Google
                </Action>
              </>
            )}
          </div>
        </section>

        <section className="profile-section">
          <div className="group-label">Шаблоны</div>
          <div className="subtask-list">
            {templates.map(template => (
              <Action
                className="subtask"
                key={template.id}
                onClick={() => go({ name: 'template', templateId: template.id })}
                label={`Изменить шаблон ${template.name}`}
              >
                <Icon name="layers" size="sm" />
                <span className="grow">
                  {template.name}
                  <small> · {template.items.length} {plural(template.items.length, ['дело', 'дела', 'дел'])}</small>
                </span>
                <Icon name="chevron" size="sm" />
              </Action>
            ))}
            {templates.length === 0 && <div className="subtask muted-copy">Шаблонов пока нет.</div>}
          </div>
          <div className="button-pair">
            <Action className="secondary-button" onClick={() => go({ name: 'template' })}>
              <Icon name="plus" size="sm" /> Новый шаблон
            </Action>
            <Action className="secondary-button" onClick={saveDayAsTemplate} disabled={dayTasks.length === 0}>
              <Icon name="layers" size="sm" /> Из дня «{formatChip(date).toLowerCase()}»
            </Action>
          </div>
        </section>

      </main>
      <BottomNav tab="profile" navigate={tab => go({ name: tab })} />
    </>
  )
}

/* ─────────────── Приложение ─────────────── */

export default function App() {
  const store = useStore()
  const { data, change } = store
  const [route, setRoute] = useState<Route>({ name: 'today' })
  // null — «сегодня»: так после полуночи приложение само переходит на новый день
  const [pickedDate, setPickedDate] = useState<string | null>(null)
  const [, setWakeTick] = useState(0)
  const date = pickedDate ?? todayKey()
  const setDate = (value: string) => setPickedDate(value === todayKey() ? null : value)
  const [toast, setToast] = useState<Toast | null>(null)
  const notify: Notify = (text, action) => setToast({ id: Date.now(), text, action })

  useEffect(() => {
    const wake = () => document.visibilityState === 'visible' && setWakeTick(tick => tick + 1)
    document.addEventListener('visibilitychange', wake)
    window.addEventListener('focus', wake)
    return () => {
      document.removeEventListener('visibilitychange', wake)
      window.removeEventListener('focus', wake)
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), toast.action ? 5000 : 2500)
    return () => window.clearTimeout(timer)
  }, [toast])
  const fullName = store.session?.user.user_metadata?.full_name as string | undefined
  const name = fullName ? fullName.split(' ')[0] : null

  const calendar = useCalendarSync(data)

  const go = (next: Route) => setRoute(next)

  let content
  switch (route.name) {
    case 'add':
      content = <AddScreen data={data} change={change} date={date} go={go} notify={notify} />
      break
    case 'detail':
      content = <DetailScreen data={data} change={change} taskId={route.taskId} go={go} calendar={calendar} notify={notify} />
      break
    case 'goals':
      content = <GoalsScreen data={data} go={go} />
      break
    case 'goal':
      content = <GoalScreen data={data} change={change} goalId={route.goalId} go={go} calendar={calendar} />
      break
    case 'goal-edit':
      content = <GoalEditScreen key={route.goalId ?? 'new'} data={data} change={change} goalId={route.goalId} go={go} />
      break
    case 'template':
      content = <TemplateEditScreen key={route.templateId ?? 'new'} data={data} change={change} templateId={route.templateId} go={go} />
      break
    case 'habits':
      content = <HabitsScreen data={data} change={change} go={go} />
      break
    case 'week':
      content = <WeekScreen data={data} setDate={setDate} go={go} />
      break
    case 'profile':
      content = <ProfileScreen data={data} change={change} date={date} go={go} store={store} name={name} calendar={calendar} />
      break
    default:
      content = <TodayScreen data={data} change={change} date={date} setDate={setDate} go={go} name={name} calendar={calendar} />
  }

  return (
    <div className="app-shell">
      <div className="phone-frame">
        {content}
        {toast && (
          <div className="toast" key={toast.id} role="status">
            <span>{toast.text}</span>
            {toast.action && (
              <Action
                className="toast-action"
                onClick={() => {
                  toast.action?.run()
                  setToast(null)
                }}
              >
                {toast.action.label}
              </Action>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
