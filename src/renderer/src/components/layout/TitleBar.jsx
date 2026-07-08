import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useTheme } from '../../contexts/ThemeContext'
import logoIcon from '../../assets/icon.png'

export default function TitleBar() {
  if (!window.electron) return null

  const location = useLocation()
  const { theme } = useTheme()
  const isLoginPage = location.pathname === '/login'
  const [isMaximized, setIsMaximized] = useState(false)

  const platform = window.api?.platform || 'win32'
  const isMac = platform === 'darwin'

  // Query initial maximized state and subscribe to changes
  useEffect(() => {
    if (window.api) {
      // Get initial state
      if (typeof window.api.isWindowMaximized === 'function') {
        window.api.isWindowMaximized().then((maximized) => {
          setIsMaximized(maximized)
        })
      }

      // Subscribe to updates
      if (typeof window.api.onWindowMaximized === 'function') {
        const unsubscribe = window.api.onWindowMaximized((maximized) => {
          setIsMaximized(maximized)
        })
        return unsubscribe
      }
    }
    return undefined
  }, [])

  // Compute CSS classes based on the theme and page
  let bgClass = ''
  let textClass = ''
  let borderClass = ''

  if (isLoginPage) {
    // Blends with the login dark gradient
    bgClass = 'bg-[#0f172a]/90 backdrop-blur-md'
    textClass = 'text-slate-200'
    borderClass = 'border-b border-slate-800/40'
  } else if (theme === 'dark') {
    bgClass = 'bg-[#0f172a]'
    textClass = 'text-slate-200'
    borderClass = 'border-b border-slate-800'
  } else {
    bgClass = 'bg-white'
    textClass = 'text-slate-700'
    borderClass = 'border-b border-slate-200/80'
  }

  // Adjust padding depending on platform to prevent overlap with native controls
  // macOS needs left padding for traffic lights (~80px)
  // Windows controls go edge-to-edge (0px padding)
  const leftPadding = isMac ? 'pl-20' : 'pl-4'
  const rightPadding = platform === 'win32' ? 'pr-0' : 'pr-4'

  return (
    <div
      style={{ WebkitAppRegion: 'drag' }}
      className={`
        flex items-center justify-between h-9 select-none z-50 shrink-0
        ${bgClass} ${textClass} ${borderClass} ${leftPadding} ${rightPadding}
        transition-colors duration-200
      `}
    >
      {/* Left side: App Logo and Title */}
      <div className="flex items-center gap-2">
        <img
          src={logoIcon}
          alt="AttendEase"
          className="w-4 h-4 object-contain"
          style={{ WebkitAppRegion: 'no-drag' }}
        />
        <div className="flex items-center gap-1.5 font-sans">
          <span className="text-xs font-bold tracking-wide">AttendEase</span>
          <span className="text-[10px] opacity-40 font-medium">|</span>
          <span className="text-[10px] opacity-60 font-medium tracking-tight">
            Staff Attendance System
          </span>
        </div>
      </div>

      {/* Middle/Right: Indicator or empty draggable area */}
      <div className="flex flex-1 items-center justify-end h-full">
        {!isLoginPage && (
          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-semibold tracking-wide mr-4">
            v1.0.0
          </span>
        )}

        {/* Windows Caption Controls */}
        {platform === 'win32' && (
          <div className="flex h-full items-center shrink-0" style={{ WebkitAppRegion: 'no-drag' }}>
            {/* Minimize button */}
            <button
              onClick={() => window.api?.minimizeWindow()}
              className="flex items-center justify-center w-12 h-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors duration-100"
              data-tooltip="Minimize"
              data-tooltip-pos="bottom"
            >
              <svg width="10" height="1" viewBox="0 0 10 1">
                <line x1="0" y1="0.5" x2="10" y2="0.5" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>

            {/* Maximize / Restore button */}
            <button
              onClick={() => window.api?.maximizeWindow()}
              className="flex items-center justify-center w-12 h-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors duration-100"
              data-tooltip={isMaximized ? 'Restore' : 'Maximize'}
              data-tooltip-pos="bottom"
            >
              {isMaximized ? (
                <svg width="10" height="10" viewBox="0 0 10 10">
                  <path
                    d="M2.5 0.5 h5 v5 h-5 z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.2"
                  />
                  <path
                    d="M0.5 2.5 h5 v5 h-5 z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.2"
                  />
                </svg>
              ) : (
                <svg width="10" height="10" viewBox="0 0 10 10">
                  <rect
                    x="0.5"
                    y="0.5"
                    width="9"
                    height="9"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.2"
                  />
                </svg>
              )}
            </button>

            {/* Close button */}
            <button
              onClick={() => window.api?.closeWindow()}
              className="flex items-center justify-center w-12 h-full hover:bg-red-600 hover:text-white text-slate-500 dark:text-slate-400 transition-colors duration-100"
              data-tooltip="Close"
              data-tooltip-pos="bottom"
            >
              <svg width="10" height="10" viewBox="0 0 10 10">
                <path d="M1 1 L9 9 M9 1 L1 9" fill="none" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
