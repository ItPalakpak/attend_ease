// src/shared/components/DateRangePicker/DateRangePicker.jsx
// Combined date-from / date-to picker with preset ranges and dual-month calendar.

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import './DateRangePicker.css'

const PRESETS = [
  { label: 'All', id: 'all' },
  { label: 'Today', id: 'today' },
  { label: 'Yesterday', id: 'yesterday' },
  { label: 'This week', id: 'this_week' },
  { label: 'Last week', id: 'last_week' },
  { label: 'This month', id: 'this_month' },
  { label: 'Last month', id: 'last_month' },
  { label: 'This year', id: 'this_year' },
  { label: 'Last year', id: 'last_year' },
  { label: 'Custom range', id: 'custom' }
]

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
]

function formatDate(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return `${MONTH_NAMES[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}`
}

function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseIso(s) {
  if (!s) return null
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function getPresetRange(id) {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const d = now.getDate()
  const day = now.getDay() // 0 = Sunday

  switch (id) {
    case 'all': {
      return { from: '1970-01-01', to: isoDate(now) }
    }
    case 'today': {
      const t = isoDate(now)
      return { from: t, to: t }
    }
    case 'yesterday': {
      const yest = new Date(y, m, d - 1)
      const t = isoDate(yest)
      return { from: t, to: t }
    }
    case 'this_week': {
      // Monday-based week
      const monOffset = day === 0 ? 6 : day - 1
      const mon = new Date(y, m, d - monOffset)
      const sun = new Date(y, m, d + ((7 - day) % 7))
      return { from: isoDate(mon), to: isoDate(sun) }
    }
    case 'last_week': {
      // Monday-based previous week
      const monOff = day === 0 ? 6 : day - 1
      const lastMon = new Date(y, m, d - monOff - 7)
      const lastSun = new Date(y, m, d - monOff - 1)
      return { from: isoDate(lastMon), to: isoDate(lastSun) }
    }
    case 'this_month': {
      const last = new Date(y, m + 1, 0)
      return { from: isoDate(new Date(y, m, 1)), to: isoDate(last) }
    }
    case 'last_month': {
      const first = new Date(y, m - 1, 1)
      const last = new Date(y, m, 0)
      return { from: isoDate(first), to: isoDate(last) }
    }
    case 'this_year': {
      return { from: isoDate(new Date(y, 0, 1)), to: isoDate(new Date(y, 11, 31)) }
    }
    case 'last_year': {
      return { from: isoDate(new Date(y - 1, 0, 1)), to: isoDate(new Date(y - 1, 11, 31)) }
    }
    default:
      return null
  }
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function getCalendarDays(year, month) {
  const firstDay = new Date(year, month, 1).getDay() // 0=Sun
  const total = daysInMonth(year, month)
  const prevTotal = daysInMonth(year, month - 1)
  const days = []
  // Pad previous month
  for (let i = firstDay; i > 0; i--) {
    days.push({
      d: prevTotal - i + 1,
      m: -1,
      y: month === 0 ? year - 1 : year,
      mm: month === 0 ? 11 : month - 1
    })
  }
  // Current month
  for (let i = 1; i <= total; i++) {
    days.push({ d: i, m: 0, y: year, mm: month })
  }
  // Pad next month to 42 cells (6 rows)
  const rem = 42 - days.length
  for (let i = 1; i <= rem; i++) {
    days.push({ d: i, m: 1, y: month === 11 ? year + 1 : year, mm: month === 11 ? 0 : month + 1 })
  }
  return days
}

function isSameDay(a, b) {
  return (
    a &&
    b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function isBetween(target, start, end) {
  if (!start || !end || !target) return false
  const s = +new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const e = +new Date(end.getFullYear(), end.getMonth(), end.getDate())
  const t = +new Date(target.getFullYear(), target.getMonth(), target.getDate())
  return t > Math.min(s, e) && t < Math.max(s, e)
}

export function DateRangePicker({ dateFrom, dateTo, onChange, className = '' }) {
  const [open, setOpen] = useState(false)
  const [leftMonth, setLeftMonth] = useState(() => {
    const d = parseIso(dateFrom) || new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const [tempFrom, setTempFrom] = useState(dateFrom)
  const [tempTo, setTempTo] = useState(dateTo)
  const [picking, setPicking] = useState(null) // 'from' | 'to' | null
  const ref = useRef(null)
  const panelRef = useRef(null)
  const [panelStyle, setPanelStyle] = useState({})

  // Keep temp state in sync with props when opening
  useEffect(() => {
    if (open) {
      setTempFrom(dateFrom)
      setTempTo(dateTo)
      setPicking(null)
      const d = parseIso(dateFrom) || new Date()
      setLeftMonth({ year: d.getFullYear(), month: d.getMonth() })
    }
  }, [open, dateFrom, dateTo])

  // Compute panel position when opening so it stays fully visible
  useLayoutEffect(() => {
    if (open && ref.current) {
      const rect = ref.current.getBoundingClientRect()
      const gap = 8
      const margin = 16
      let top = rect.bottom + gap
      let left = rect.left
      // Estimate panel dimensions (compact=560, default=640)
      const estWidth = className.includes('drp--compact') ? 560 : 640
      const estHeight = 420 // approximate natural height of the panel
      const spaceBelow = window.innerHeight - rect.bottom - gap - margin
      const spaceAbove = rect.top - gap - margin

      // If not enough space below but more above, flip above the trigger
      if (spaceBelow < estHeight && spaceAbove > spaceBelow) {
        top = rect.top - gap - estHeight
        if (top < margin) top = margin
      }
      // Shift left if overflowing right edge
      if (left + estWidth > window.innerWidth - margin) {
        left = window.innerWidth - estWidth - margin
      }
      if (left < margin) left = margin
      setPanelStyle({ top, left, zIndex: 1100 })
    }
  }, [open, className])

  // Close on outside click, scroll, or window resize
  useEffect(() => {
    function handleOutside(e) {
      const clickedTrigger = ref.current && ref.current.contains(e.target)
      const clickedPanel = panelRef.current && panelRef.current.contains(e.target)
      if (!clickedTrigger && !clickedPanel) {
        setOpen(false)
      }
    }
    function handleClose() {
      setOpen(false)
    }
    if (open) {
      document.addEventListener('mousedown', handleOutside)
      window.addEventListener('scroll', handleOutside, true)
      window.addEventListener('resize', handleClose)
      return () => {
        document.removeEventListener('mousedown', handleOutside)
        window.removeEventListener('scroll', handleOutside, true)
        window.removeEventListener('resize', handleClose)
      }
    }
  }, [open])

  const rightMonth = {
    year: leftMonth.month === 11 ? leftMonth.year + 1 : leftMonth.year,
    month: leftMonth.month === 11 ? 0 : leftMonth.month + 1
  }

  const fromDate = parseIso(tempFrom)
  const toDate = parseIso(tempTo)

  const handlePreset = useCallback((id) => {
    if (id === 'custom') {
      setPicking('from')
      return
    }
    const range = getPresetRange(id)
    if (range) {
      setTempFrom(range.from)
      setTempTo(range.to)
      setPicking(null)
      const d = parseIso(range.from) || new Date()
      setLeftMonth({ year: d.getFullYear(), month: d.getMonth() })
    }
  }, [])

  const handleDayClick = useCallback(
    (cell) => {
      const clicked = new Date(cell.y, cell.mm, cell.d)
      const clickedIso = isoDate(clicked)

      if (picking === null || picking === 'from') {
        setTempFrom(clickedIso)
        setTempTo(clickedIso)
        setPicking('to')
      } else {
        // picking === 'to'
        setTempTo(clickedIso)
        if (clicked < parseIso(tempFrom)) {
          setTempFrom(clickedIso)
          setTempTo(tempFrom)
        }
        setPicking(null)
      }
    },
    [picking, tempFrom]
  )

  const handleApply = () => {
    onChange({ dateFrom: tempFrom, dateTo: tempTo })
    setOpen(false)
  }

  const handleCancel = () => {
    setTempFrom(dateFrom)
    setTempTo(dateTo)
    setPicking(null)
    setOpen(false)
  }

  const displayText = () => {
    if (!dateFrom || !dateTo) return 'Select date range'

    const shortenMonth = (str) => {
      return str.replace(
        /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b/gi,
        (match, p1) => {
          return p1 + (match.length > 3 ? '.' : '')
        }
      )
    }

    const a = shortenMonth(formatDate(dateFrom))
    const b = shortenMonth(formatDate(dateTo))
    return a === b ? a : `${a} - ${b}`
  }

  const isActive = !!dateFrom && !!dateTo
  const todayStr = isoDate(new Date())

  function renderMonth({ year, month }, side) {
    const days = getCalendarDays(year, month)
    return (
      <div className="drp-calendar">
        <div className="drp-calendar__header">
          {side === 'left' && (
            <button
              className="drp-calendar__nav"
              onClick={() =>
                setLeftMonth((p) => ({
                  year: p.month === 0 ? p.year - 1 : p.year,
                  month: p.month === 0 ? 11 : p.month - 1
                }))
              }
            >
              <ChevronLeft size={16} />
            </button>
          )}
          <span className="drp-calendar__title">
            {MONTH_NAMES[month]} {year}
          </span>
          {side === 'right' && (
            <button
              className="drp-calendar__nav"
              onClick={() =>
                setLeftMonth((p) => ({
                  year: p.month === 11 ? p.year + 1 : p.year,
                  month: p.month === 11 ? 0 : p.month + 1
                }))
              }
            >
              <ChevronRight size={16} />
            </button>
          )}
        </div>
        <div className="drp-calendar__weekdays">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <span key={d} className="drp-calendar__weekday">
              {d}
            </span>
          ))}
        </div>
        <div className="drp-calendar__days">
          {days.map((cell, i) => {
            const date = new Date(cell.y, cell.mm, cell.d)
            const inMonth = cell.m === 0
            const isFuture = isoDate(date) > todayStr
            const isFrom = isSameDay(date, fromDate)
            const isTo = isSameDay(date, toDate)
            const inRange = inMonth && !isFuture && isBetween(date, fromDate, toDate)
            const isStartEdge = isFrom && toDate && !isSameDay(fromDate, toDate)
            const isEndEdge = isTo && fromDate && !isSameDay(fromDate, toDate)

            let cls = 'drp-day'
            if (!inMonth) cls += ' drp-day--outside'
            if (isFuture) cls += ' drp-day--future'
            if (isFrom || isTo) cls += ' drp-day--selected'
            else if (inRange) cls += ' drp-day--range'
            if (isStartEdge) cls += ' drp-day--start'
            if (isEndEdge) cls += ' drp-day--end'

            return (
              <button
                key={i}
                className={cls}
                onClick={() => handleDayClick(cell)}
                disabled={!inMonth || isFuture}
                type="button"
              >
                <span className="drp-day__label">{cell.d}</span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // Determine which preset is currently active (if any)
  const activePreset =
    PRESETS.find((p) => {
      if (p.id === 'custom') return false
      const r = getPresetRange(p.id)
      return r && r.from === tempFrom && r.to === tempTo
    })?.id || (picking ? 'custom' : null)

  return (
    <div className={`drp ${className}`} ref={ref}>
      <button
        className={`drp__trigger${isActive ? ' drp__trigger--active' : ''} ${className.includes('w-full') ? 'w-full justify-between' : ''}`}
        onClick={() => setOpen((p) => !p)}
        type="button"
        title="Filter by date range"
      >
        <Calendar size={14} />
        <span className="drp__trigger-text">{displayText()}</span>
        <span className="drp__trigger-caret">▾</span>
      </button>

      {open &&
        createPortal(
          // CHANGED: append drp__panel--compact class when in compact mode to ensure correct min-width for ported element
          <div
            className={`drp__panel${className.includes('drp--compact') ? ' drp__panel--compact' : ''}`}
            style={panelStyle}
            ref={panelRef}
          >
            <div className="drp__panel-inner">
              <div className="drp__sidebar">
                <div className="drp__presets">
                  {PRESETS.map((p) => (
                    <button
                      key={p.id}
                      className={`drp__preset${activePreset === p.id ? ' drp__preset--active' : ''}`}
                      onClick={() => handlePreset(p.id)}
                      type="button"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="drp__body">
                <div className="drp__calendars">
                  {renderMonth(leftMonth, 'left')}
                  {renderMonth(rightMonth, 'right')}
                </div>
              </div>
            </div>
            <div className="drp__footer">
              <button className="drp__btn drp__btn--secondary" onClick={handleCancel} type="button">
                Cancel
              </button>
              <button className="drp__btn drp__btn--primary" onClick={handleApply} type="button">
                Apply
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
