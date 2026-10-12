import { addDays, formatChip, todayKey } from './dates'
import { Action, Icon } from './ui'

/** Открывает системный выбор даты или времени по нажатию, где браузер это умеет. */
function openPicker(input: HTMLInputElement) {
  try {
    input.showPicker?.()
  } catch {
    // старые браузеры откроют выбор сами, по фокусу
  }
}

/** Плашки «Сегодня / Завтра / Послезавтра» и «Другая дата» с календариком. */
export function DateChips({ value, onChange }: { value: string; onChange: (date: string) => void }) {
  const today = todayKey()
  const quick = [0, 1, 2].map(days => addDays(today, days))
  const isOther = !quick.includes(value)

  return (
    <div className="chip-row">
      {quick.map(day => (
        <Action key={day} className={`suggestion-chip ${value === day ? 'selected' : ''}`} onClick={() => onChange(day)}>
          {formatChip(day, today)}
        </Action>
      ))}
      <label className={`suggestion-chip picker-chip ${isOther ? 'selected' : ''}`}>
        <Icon name="calendar" size="sm" /> {isOther ? formatChip(value, today) : 'Другая дата'}
        <input
          type="date"
          aria-label="Выбрать дату"
          value={value}
          onClick={event => openPicker(event.currentTarget)}
          onChange={event => event.target.value && onChange(event.target.value)}
        />
      </label>
    </div>
  )
}

const PRESETS = [
  { time: '09:00', label: 'Утро' },
  { time: '13:00', label: 'День' },
  { time: '19:00', label: 'Вечер' },
]

/** Плашки времени: «Без времени», утро / день / вечер и своё время. */
export function TimeChips({ value, onChange }: { value: string | null; onChange: (time: string | null) => void }) {
  const isPreset = PRESETS.some(p => p.time === value)
  const isCustom = value !== null && !isPreset

  return (
    <div className="chip-row">
      <Action className={`suggestion-chip ${value === null ? 'selected' : ''}`} onClick={() => onChange(null)}>
        Без времени
      </Action>
      {PRESETS.map(preset => (
        <Action
          key={preset.time}
          className={`suggestion-chip ${value === preset.time ? 'selected' : ''}`}
          onClick={() => onChange(preset.time)}
        >
          {preset.label} · {preset.time}
        </Action>
      ))}
      <label className={`suggestion-chip picker-chip ${isCustom ? 'selected' : ''}`}>
        <Icon name="clock" size="sm" /> {isCustom ? value : 'Своё время'}
        <input
          type="time"
          aria-label="Выбрать время"
          value={value ?? ''}
          onClick={event => openPicker(event.currentTarget)}
          onChange={event => onChange(event.target.value || null)}
        />
      </label>
    </div>
  )
}
