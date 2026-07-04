import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import logoIcon from '../../assets/icon.png'
import {
  LayoutDashboard,
  Users,
  ScanLine,
  CalendarClock,
  FileBarChart2,
  Shield,
  Building2,
  CreditCard,
  DatabaseZap,
  TrendingUp,
  SlidersHorizontal,
  Settings,
  HardDriveDownload,
  ScrollText,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Fingerprint,
  Fuel
} from 'lucide-react'

const navGroups = [
  {
    groupName: 'General',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
      { label: 'Scan Attendance', icon: ScanLine, path: '/scan' },
      { label: 'Analytics', icon: TrendingUp, path: '/analytics' }
    ]
  },
  {
    groupName: 'Management',
    items: [
      { label: 'Staff', icon: Users, path: '/staff' },
      { label: 'Roles', icon: Shield, path: '/roles' },
      { label: 'ID Cards', icon: CreditCard, path: '/id-cards' }
    ]
  },
  {
    groupName: 'Records',
    items: [
      { label: 'Attendance History', icon: CalendarClock, path: '/attendance' },
      { label: 'Gasoline Subsidy', icon: Fuel, path: '/gasoline' },
      { label: 'Reports', icon: FileBarChart2, path: '/reports' },
      { label: 'Audit Logs', icon: ScrollText, path: '/audit-logs' }
    ]
  },
  {
    groupName: 'System',
    items: [
      { label: 'Data Import', icon: DatabaseZap, path: '/data-import' },
      { label: 'Backup', icon: HardDriveDownload, path: '/backup' },
      { label: 'Settings', icon: Settings, path: '/settings' }
    ]
  }
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const isActive = (path) => {
    if (path === '/dashboard') return location.pathname === '/dashboard' || location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <aside
      className={`
        relative flex flex-col h-screen
        bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950
        border-r border-slate-800/50
        transition-all duration-300 ease-in-out
        ${collapsed ? 'w-[72px]' : 'w-64'}
        shrink-0
      `}
    >
      {/* Decorative gradient line at the very top */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500" />

      {/* Brand Section */}
      <div className="flex items-center gap-3 px-4 pt-6 pb-5 border-b border-slate-800/60">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 shadow-lg shadow-sky-500/20 shrink-0 p-1.5">
          <img src={logoIcon} alt="AttendEase Logo" className="w-full h-full object-contain" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-lg font-bold text-white tracking-tight leading-tight">
              Attend<span className="text-sky-400">Ease</span>
            </h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest leading-tight">
              Attendance System
            </p>
          </div>
        )}
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="
          absolute -right-3 top-20 z-30
          w-6 h-6 rounded-full
          bg-slate-800 border border-slate-700
          flex items-center justify-center
          text-slate-400 hover:text-sky-400 hover:border-sky-500/50
          transition-all duration-200
          shadow-lg
        "
        data-tooltip={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        data-tooltip-pos="right"
      >
        {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>

      {/* Navigation */}
      <nav className={`flex-1 py-4 px-2 space-y-4 scrollbar-thin ${collapsed ? 'overflow-visible' : 'overflow-y-auto'}`}>
        {navGroups.map((group, groupIdx) => (
          <div key={group.groupName} className="space-y-0.5">
            {/* Group Header or Divider */}
            {collapsed ? (
              groupIdx > 0 && (
                <div className="my-2 border-t border-slate-800/40 mx-2" />
              )
            ) : (
              <div className={`px-3 pb-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider ${groupIdx > 0 ? 'mt-4' : 'mt-1'}`}>
                {group.groupName}
              </div>
            )}

            {/* Group Items */}
            {group.items.map((item) => {
              const Icon = item.icon
              const active = isActive(item.path)
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  data-tooltip={collapsed ? item.label : undefined}
                  data-tooltip-pos="right"
                  className={`
                    group relative flex items-center gap-3 px-3 py-2.5 rounded-lg
                    transition-all duration-200 ease-out
                    ${
                      active
                        ? 'bg-sky-500/10 text-sky-400'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }
                  `}
                >
                  {/* Active indicator bar */}
                  {active && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-7 rounded-r-full bg-gradient-to-b from-sky-400 to-blue-500 shadow-md shadow-sky-500/30" />
                  )}

                  <Icon
                    className={`w-5 h-5 shrink-0 transition-transform duration-200 ${
                      active ? 'text-sky-400' : 'text-slate-500 group-hover:text-slate-300'
                    } group-hover:scale-110`}
                  />

                  {!collapsed && (
                    <span
                      className={`text-sm font-medium truncate transition-colors duration-200 ${
                        active ? 'text-sky-300' : ''
                      }`}
                    >
                      {item.label}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* User / Logout Section */}
      <div className="border-t border-slate-800/60 p-3">
        <button
          onClick={handleLogout}
          className={`
            group flex items-center gap-3 w-full px-3 py-2.5 rounded-lg
            text-slate-400 hover:text-rose-400 hover:bg-rose-500/10
            transition-all duration-200
          `}
          data-tooltip={collapsed ? 'Logout' : undefined}
          data-tooltip-pos="right"
        >
          <LogOut className="w-5 h-5 shrink-0 transition-transform duration-200 group-hover:scale-110" />
          {!collapsed && (
            <div className="flex flex-col items-start overflow-hidden">
              <span className="text-sm font-medium truncate">
                {user?.username || 'Admin'}
              </span>
              <span className="text-[10px] text-slate-600 group-hover:text-rose-400/60 transition-colors">
                Sign out
              </span>
            </div>
          )}
        </button>
      </div>
    </aside>
  )
}
