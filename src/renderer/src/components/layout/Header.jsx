import { useState, useEffect, useMemo, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { Clock, CalendarDays, Sun, Moon, RefreshCw } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { getPageTitle, getPageDescription } from '../../shared/routeHelpers'

const refreshableRoutes = ['/dashboard', '/audit-logs']

export default function Header() {
  const location = useLocation()
  const { theme, toggleTheme } = useTheme()
  const [now, setNow] = useState(new Date())

  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Listen for refresh-complete events from pages
  useEffect(() => {
    const handleComplete = () => setIsRefreshing(false)
    window.addEventListener('header-refresh-complete', handleComplete)
    return () => window.removeEventListener('header-refresh-complete', handleComplete)
  }, [])

  const pageTitle = useMemo(() => getPageTitle(location.pathname), [location.pathname])
  const pageDescription = useMemo(() => getPageDescription(location.pathname), [location.pathname])
  const showRefresh = refreshableRoutes.includes(location.pathname)

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true)
    window.dispatchEvent(new CustomEvent('header-refresh'))
  }, [])

  const formattedDate = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  const formattedTime = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  })

  return (
    <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-200/80">
      <div className="flex items-center justify-between px-6 py-2.5">
        {/* Left side: Title */}
        <div className="min-w-0">
          {/* Page Title */}
          <h2 className="text-xl font-bold text-slate-800 tracking-tight truncate">{pageTitle}</h2>
          {/* Page Description */}
          {pageDescription && (
            <p className="text-xs text-slate-400 mt-0.5 truncate">{pageDescription}</p>
          )}
        </div>

        {/* Right side: Date & Time + Theme Toggle */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="hidden sm:flex items-center gap-2 text-slate-500">
            <CalendarDays className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium">{formattedDate}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200/80">
            <Clock className="w-4 h-4 text-sky-500" />
            <span className="text-sm font-semibold text-slate-700 tabular-nums tracking-wide">
              {formattedTime}
            </span>
          </div>
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center p-2 rounded-lg border border-slate-200/80 bg-slate-50 hover:bg-slate-100 text-slate-500 transition-all hover:scale-105 active:scale-95"
            data-tooltip={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            data-tooltip-pos="bottom"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-500" />
            ) : (
              <Moon className="w-4 h-4 text-slate-650" />
            )}
          </button>
          {showRefresh && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center justify-center p-2 rounded-lg border border-slate-200/80 bg-slate-50 hover:bg-slate-100 text-slate-500 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
              data-tooltip="Refresh"
              data-tooltip-pos="bottom"
            >
              <RefreshCw
                className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-sky-500' : 'text-slate-500'}`}
              />
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
