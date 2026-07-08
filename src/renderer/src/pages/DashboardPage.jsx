import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, UserCheck, Clock, UserX, Shield, Building2 } from 'lucide-react'
import StatusBadge from '../components/ui/StatusBadge'

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalStaff: 0,
    presentToday: 0,
    lateToday: 0,
    absToday: 0, // Fallback absent if absToday
    absentToday: 0,
    totalRoles: 0,
    totalDepts: 0
  })
  const [attendance, setAttendance] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()

  const getTodayStr = () => {
    const d = new Date()
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const fetchDashboardData = useCallback(async () => {
    try {
      const todayStr = getTodayStr()
      const statsRes = await window.api.getDashboardStats(todayStr)
      const attendanceRes = await window.api.getDailyAttendance(todayStr)

      setStats({
        totalStaff: statsRes.totalStaff || 0,
        presentToday: statsRes.presentToday || 0,
        lateToday: statsRes.lateToday || 0,
        absentToday:
          statsRes.absentToday !== undefined ? statsRes.absentToday : statsRes.absToday || 0,
        totalRoles: statsRes.totalRoles || 0,
        totalDepts: statsRes.totalDepts || 0
      })
      setAttendance(attendanceRes || [])
    } catch (err) {
      console.error('Error fetching dashboard stats:', err)
    } finally {
      setIsLoading(false)
      window.dispatchEvent(new Event('header-refresh-complete'))
    }
  }, [])

  useEffect(() => {
    fetchDashboardData()
    const interval = setInterval(fetchDashboardData, 30000)
    return () => clearInterval(interval)
  }, [fetchDashboardData])

  // Listen for refresh from header
  useEffect(() => {
    const handler = () => fetchDashboardData()
    window.addEventListener('header-refresh', handler)
    return () => window.removeEventListener('header-refresh', handler)
  }, [fetchDashboardData])

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-sky-500" />
      </div>
    )
  }

  const statCards = [
    {
      label: 'Total Staff',
      value: stats.totalStaff,
      icon: Users,
      gradient: 'from-blue-500 to-indigo-600',
      shadow: 'shadow-blue-500/10'
    },
    {
      label: 'Present Today',
      value: stats.presentToday,
      icon: UserCheck,
      gradient: 'from-emerald-400 to-teal-600',
      shadow: 'shadow-emerald-500/10'
    },
    {
      label: 'Late Today',
      value: stats.lateToday,
      icon: Clock,
      gradient: 'from-primary-300 to-primary-600',
      shadow: 'shadow-primary-500/10'
    },
    {
      label: 'Absent Today',
      value: stats.absentToday,
      icon: UserX,
      gradient: 'from-rose-450 to-red-600',
      shadow: 'shadow-red-500/10'
    },
    {
      label: 'Total Roles',
      value: stats.totalRoles,
      icon: Shield,
      gradient: 'from-indigo-400 to-violet-600',
      shadow: 'shadow-indigo-500/10'
    },
    {
      label: 'Total Departments',
      value: stats.totalDepts,
      icon: Building2,
      gradient: 'from-sky-400 to-blue-500',
      shadow: 'shadow-sky-500/10'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {statCards.map((card, idx) => (
          <div
            key={idx}
            className={`relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-lg ${card.shadow} transition-all duration-300 hover:-translate-y-1 hover:shadow-xl`}
          >
            {/* Background Accent */}
            <div
              className={`absolute top-0 right-0 h-16 w-16 translate-x-4 -translate-y-4 rounded-full bg-gradient-to-br ${card.gradient} opacity-10`}
            />

            <div className="flex flex-col gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${card.gradient} text-white shadow-md`}
              >
                <card.icon size={20} />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  {card.label}
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-800">{card.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Today's Attendance Table */}
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Today's Attendance</h2>
            <p className="text-xs text-slate-500">
              List of staff clock-in/out logs for today ({getTodayStr()})
            </p>
          </div>
        </div>

        {attendance.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 text-slate-400">
            <UserCheck size={36} className="stroke-1" />
            <p className="mt-2 text-sm">No attendance records logged for today yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-4">Photo</th>
                  <th className="py-3 px-4">Staff ID</th>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Time In</th>
                  <th className="py-3 px-4">Time Out</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-sm text-slate-700">
                {attendance.map((log) => (
                  <tr
                    key={log.staff_id}
                    onClick={() => navigate(`/staff/${log.staff_id}`)}
                    className="group cursor-pointer transition-all hover:bg-slate-50"
                  >
                    <td className="py-3 px-4">
                      {log.photo_path ? (
                        <img
                          src={`file://${log.photo_path}`}
                          alt={log.first_name}
                          className="h-8 w-8 rounded-full object-cover shadow-sm ring-1 ring-slate-100"
                          onError={(e) => {
                            e.target.style.display = 'none'
                            e.target.nextSibling.style.display = 'flex'
                          }}
                        />
                      ) : null}
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-650 ${log.photo_path ? 'hidden' : ''}`}
                      >
                        {log.first_name?.[0]}
                        {log.last_name?.[0]}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-600">
                      {log.formatted_id || log.staff_id}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800 group-hover:text-sky-600">
                      {log.first_name} {log.last_name}
                    </td>
                    <td className="py-3 px-4 text-slate-500">{log.department_name}</td>
                    <td className="py-3 px-4 font-semibold text-slate-650">
                      {log.time_in || '--:--'}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-650">
                      {log.time_out || '--:--'}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={log.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
