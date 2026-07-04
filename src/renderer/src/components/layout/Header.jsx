import { useState, useEffect, useMemo, useCallback } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { ChevronRight, Clock, CalendarDays, Sun, Moon, RefreshCw } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'

const refreshableRoutes = ['/dashboard', '/audit-logs']

const routeTitles = {
  '/dashboard': 'Dashboard Overview',
  '/staff': 'Staff Management',
  '/staff/new': 'Add New Staff',
  '/staff/edit': 'Edit Staff',
  '/scan': 'Scan Attendance',
  '/attendance': 'Attendance History',
  '/reports': 'Reports',
  '/gasoline': 'Gasoline Subsidy Logs',
  '/roles': 'Role Management',
  '/departments': 'Department Management',
  '/id-cards': 'ID Cards',
  '/data-import': 'Data Import',
  '/analytics': 'Data Analytics',
  '/filter-config': 'Filter Configuration',
  '/settings': 'Settings',
  '/backup': 'Backup & Restore',
  '/audit-logs': 'Audit Logs'
}

const routeDescriptions = {
  '/dashboard': 'Real-time attendance tracking and organization summary',
  '/staff': 'View and manage staff records, designations, and security credentials',
  '/staff/new': 'Create a new staff profile in the database',
  '/staff/edit': 'Modify employee information and status',
  '/scan': 'Scan staff QR ID code to log Clock-In or Clock-Out',
  '/attendance': 'Query, filter, and track historical attendance logs',
  '/reports': 'Generate, view, and export organization attendance metrics',
  '/gasoline': 'Manage delivery rider discounts, copay status, and monthly employer payout sheets',
  '/roles': 'Manage user roles and designations within the organization',
  '/departments': 'Manage organizational divisions and departments',
  '/id-cards': 'Design and download official Flash Express employee IDs',
  '/data-import': 'Import CSV or Excel sheets for advanced filtering and calculations (parcels weight counting)',
  '/analytics': 'Query datasets, compute stats, and run cargo/parcel weight filter calculations',
  '/filter-config': 'Configure which spreadsheet columns are filterable in the Data Analytics dashboard',
  '/settings': 'Configure attendance rules, admin profile, and custom dynamic filters for imported spreadsheets',
  '/backup': 'Back up your local database and staff photos or restore from a previous archive',
  '/audit-logs': 'Track all administrative operations and database updates'
}

function getPageTitle(pathname) {
  // Exact match first
  if (routeTitles[pathname]) return routeTitles[pathname]
  // Check for dynamic segments
  if (pathname.startsWith('/staff/edit/')) return 'Edit Staff'
  if (pathname.match(/^\/staff\/[^/]+$/)) return 'Staff Profile'
  if (pathname.startsWith('/id-cards/')) return 'ID Card Preview'
  // Fallback
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length > 0) {
    return segments[segments.length - 1]
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  }
  return 'Dashboard'
}

function getPageDescription(pathname) {
  // Exact match first
  if (routeDescriptions[pathname]) return routeDescriptions[pathname]
  // Check for dynamic segments
  if (pathname.startsWith('/staff/edit/')) return routeDescriptions['/staff/edit']
  if (pathname.match(/^\/staff\/[^/]+$/)) return 'Employee details, role history, and security QR code'
  if (pathname.startsWith('/id-cards/')) return routeDescriptions['/id-cards']
  return null
}

function getBreadcrumbs(pathname) {
  const segments = pathname.split('/').filter(Boolean)
  const crumbs = [{ label: 'Home', path: '/dashboard' }]
  let currentPath = ''
  for (const segment of segments) {
    currentPath += `/${segment}`
    const label = routeTitles[currentPath] ||
      segment
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
    crumbs.push({ label, path: currentPath })
  }
  return crumbs
}

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
  const breadcrumbs = useMemo(() => getBreadcrumbs(location.pathname), [location.pathname])
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
      <div className="flex items-center justify-between px-6 py-4">
        {/* Left side: Title + Breadcrumbs */}
        <div className="min-w-0">
          {/* Breadcrumbs */}
          <nav className="flex items-center gap-1 text-xs text-slate-400 mb-1">
            {breadcrumbs.map((crumb, i) => (
              <span key={crumb.path} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="w-3 h-3 text-slate-300" />}
                {i < breadcrumbs.length - 1 ? (
                  <Link
                    to={crumb.path}
                    className="hover:text-sky-500 transition-colors duration-150"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-slate-500 font-medium">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>

          {/* Page Title */}
          <h2 className="text-xl font-bold text-slate-800 tracking-tight truncate">
            {pageTitle}
          </h2>
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
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-sky-500' : 'text-slate-500'}`} />
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
