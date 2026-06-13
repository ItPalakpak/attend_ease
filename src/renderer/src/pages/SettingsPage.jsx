import React, { useState, useEffect } from 'react'
import {
  Settings,
  Shield,
  Building,
  Clock,
  Save,
  Lock,
  AlertCircle,
  CheckCircle2,
  Sliders,
  Plus,
  Edit2,
  Trash2,
  SlidersHorizontal
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import StatusBadge from '../components/ui/StatusBadge'

export default function SettingsPage() {
  const { changePassword } = useAuth()
  const [activeTab, setActiveTab] = useState('general') // 'general', 'security', 'filters'

  // App settings state
  const [appSettings, setAppSettings] = useState({
    present_cutoff: '08:00',
    late_cutoff: '08:30',
    work_start: '08:00',
    org_name: 'AttendEase',
    org_address: '',
    working_days: [1, 2, 3, 4, 5] // Array of numbers (0 = Sun, 1 = Mon...)
  })

  // Password change state
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  // Dynamic Filters state
  const [filters, setFilters] = useState([])
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)
  const [filterModalMode, setFilterModalMode] = useState('add') // 'add' or 'edit'
  const [currentFilterId, setCurrentFilterId] = useState(null)
  const [filterFormData, setFilterFormData] = useState({
    filter_name: '',
    column_key: '',
    filter_type: 'contains',
    options_raw: '',
    display_order: 0,
    status: 'Active'
  })
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false)
  const [filterToDelete, setFilterToDelete] = useState(null)

  const [isLoading, setIsLoading] = useState(true)
  const [settingsStatus, setSettingsStatus] = useState({ type: '', message: '' })
  const [passwordStatus, setPasswordStatus] = useState({ type: '', message: '' })

  const loadSettings = async () => {
    try {
      const res = await window.api.getSettings()
      if (res) {
        // Ensure working_days is processed as an array of numbers
        let parsedWorkingDays = [1, 2, 3, 4, 5]
        if (res.working_days) {
          if (Array.isArray(res.working_days)) {
            parsedWorkingDays = res.working_days.map(Number)
          } else if (typeof res.working_days === 'string') {
            try {
              const parsed = JSON.parse(res.working_days)
              if (Array.isArray(parsed)) {
                parsedWorkingDays = parsed.map(Number)
              }
            } catch {
              // Comma separated day names string fallback
              const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
              parsedWorkingDays = res.working_days
                .split(',')
                .map((day) => dayNames.indexOf(day.trim()))
                .filter((idx) => idx !== -1)
            }
          }
        }

        setAppSettings({
          present_cutoff: res.present_cutoff || '08:00',
          late_cutoff: res.late_cutoff || '08:30',
          work_start: res.work_start || '08:00',
          org_name: res.org_name || 'AttendEase',
          org_address: res.org_address || '',
          working_days: parsedWorkingDays
        })
      }
    } catch (err) {
      console.error('Failed to load settings:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchFilters = async () => {
    try {
      const res = await window.api.getFilterDefinitions()
      setFilters(res || [])
    } catch (err) {
      console.error('Failed to fetch filter definitions:', err)
    }
  }

  useEffect(() => {
    const init = async () => {
      await loadSettings()
      await fetchFilters()
    }
    init()
  }, [])

  const handleSettingsSave = async (e) => {
    e.preventDefault()
    setSettingsStatus({ type: '', message: '' })
    try {
      // Save working_days as number array
      const res = await window.api.updateSettings(appSettings)
      if (res.success) {
        setSettingsStatus({ type: 'success', message: 'Settings saved successfully!' })
        setTimeout(() => setSettingsStatus({ type: '', message: '' }), 4000)
      } else {
        setSettingsStatus({ type: 'error', message: res.message || 'Failed to save settings.' })
      }
    } catch (err) {
      console.error(err)
      setSettingsStatus({ type: 'error', message: 'IPC error: Failed to save.' })
    }
  }

  const handlePasswordSave = async (e) => {
    e.preventDefault()
    setPasswordStatus({ type: '', message: '' })

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordStatus({ type: 'error', message: 'New passwords do not match.' })
      return
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordStatus({ type: 'error', message: 'Password must be at least 6 characters long.' })
      return
    }

    try {
      const res = await changePassword(passwordForm.oldPassword, passwordForm.newPassword)
      if (res.success) {
        setPasswordStatus({ type: 'success', message: 'Password updated successfully!' })
        setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' })
        setTimeout(() => setPasswordStatus({ type: '', message: '' }), 4000)
      } else {
        setPasswordStatus({ type: 'error', message: res.message || 'Failed to update password.' })
      }
    } catch (err) {
      console.error(err)
      setPasswordStatus({ type: 'error', message: 'IPC error: Failed to change password.' })
    }
  }

  const handleDayCheckboxChange = (dayVal) => {
    const activeDays = Array.isArray(appSettings.working_days) ? appSettings.working_days : []
    let updatedDays = []
    if (activeDays.includes(dayVal)) {
      updatedDays = activeDays.filter((d) => d !== dayVal)
    } else {
      updatedDays = [...activeDays, dayVal]
    }
    updatedDays.sort((a, b) => a - b)
    setAppSettings((prev) => ({ ...prev, working_days: updatedDays }))
  }

  // Filter Actions
  const handleOpenAddFilter = () => {
    setFilterModalMode('add')
    setFilterFormData({
      filter_name: '',
      column_key: '',
      filter_type: 'contains',
      options_raw: '',
      display_order: filters.length + 1,
      status: 'Active'
    })
    setIsFilterModalOpen(true)
  }

  const handleOpenEditFilter = (filter) => {
    setFilterModalMode('edit')
    setCurrentFilterId(filter.id)

    let rawOptions = ''
    try {
      const parsed = JSON.parse(filter.options_json)
      if (Array.isArray(parsed)) {
        rawOptions = parsed.join('\n')
      }
    } catch (e) {
      console.error('Failed to parse options JSON:', e)
    }

    setFilterFormData({
      filter_name: filter.filter_name,
      column_key: filter.column_key,
      filter_type: filter.filter_type,
      options_raw: rawOptions,
      display_order: filter.display_order || 0,
      status: filter.status || 'Active'
    })
    setIsFilterModalOpen(true)
  }

  const handleFilterFormSubmit = async (e) => {
    e.preventDefault()
    if (!filterFormData.filter_name.trim() || !filterFormData.column_key.trim()) return

    const optionsArray = filterFormData.options_raw
      .split('\n')
      .map((opt) => opt.trim())
      .filter(Boolean)

    const payload = {
      filter_name: filterFormData.filter_name.trim(),
      column_key: filterFormData.column_key.trim(),
      filter_type: filterFormData.filter_type,
      options_json: JSON.stringify(optionsArray),
      display_order: Number(filterFormData.display_order) || 0,
      status: filterFormData.status
    }

    try {
      if (filterModalMode === 'add') {
        await window.api.addFilterDefinition(payload)
      } else {
        await window.api.updateFilterDefinition(currentFilterId, payload)
      }
      setIsFilterModalOpen(false)
      fetchFilters()
    } catch (err) {
      console.error('Failed to save filter:', err)
    }
  }

  const handleOpenDeleteFilter = (filter) => {
    setFilterToDelete(filter)
    setIsConfirmDeleteOpen(true)
  }

  const handleConfirmDeleteFilter = async () => {
    if (!filterToDelete) return
    try {
      await window.api.deleteFilterDefinition(filterToDelete.id)
      fetchFilters()
    } catch (err) {
      console.error('Failed to delete filter:', err)
    } finally {
      setIsConfirmDeleteOpen(false)
      setFilterToDelete(null)
    }
  }

  const daysOfWeek = [
    { name: 'Sunday', value: 0 },
    { name: 'Monday', value: 1 },
    { name: 'Tuesday', value: 2 },
    { name: 'Wednesday', value: 3 },
    { name: 'Thursday', value: 4 },
    { name: 'Friday', value: 5 },
    { name: 'Saturday', value: 6 }
  ]

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-sky-500" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">System Configurations</h1>
        <p className="text-sm text-slate-500">Configure attendance rules, admin profile, and custom dynamic filters for imported spreadsheets</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        {/* Navigation Sidebar */}
        <div className="md:col-span-1 rounded-2xl border border-slate-100 bg-white p-4 shadow-md h-fit space-y-1">
          <button
            onClick={() => setActiveTab('general')}
            className={`flex w-full items-center gap-2.5 rounded-xl px-3.5 py-3 text-sm font-semibold transition ${
              activeTab === 'general'
                ? 'bg-sky-500/10 text-sky-600'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Building size={16} />
            <span>Organization & Rules</span>
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`flex w-full items-center gap-2.5 rounded-xl px-3.5 py-3 text-sm font-semibold transition ${
              activeTab === 'security'
                ? 'bg-sky-500/10 text-sky-600'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Shield size={16} />
            <span>Admin Credentials</span>
          </button>
          <button
            onClick={() => setActiveTab('filters')}
            className={`flex w-full items-center gap-2.5 rounded-xl px-3.5 py-3 text-sm font-semibold transition ${
              activeTab === 'filters'
                ? 'bg-sky-500/10 text-sky-600'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <SlidersHorizontal size={16} />
            <span>Dynamic Filters</span>
          </button>
        </div>

        {/* Form Area */}
        <div className="md:col-span-3 space-y-6">
          {activeTab === 'general' && (
            <form onSubmit={handleSettingsSave} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-lg space-y-6">
              <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
                <Building size={18} className="text-sky-500" />
                <span>Organization Profile & Rules</span>
              </h3>

              {settingsStatus.message && (
                <div className={`flex items-center gap-2 rounded-xl border p-4 text-sm ${
                  settingsStatus.type === 'success'
                    ? 'border-emerald-500/20 bg-emerald-50/50 text-emerald-600'
                    : 'border-red-500/20 bg-red-50/50 text-red-650'
                }`}>
                  {settingsStatus.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                  <span>{settingsStatus.message}</span>
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-450 uppercase tracking-wide">Organization Name</label>
                  <input
                    type="text"
                    value={appSettings.org_name}
                    onChange={(e) => setAppSettings({ ...appSettings, org_name: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-450 uppercase tracking-wide">Organization Address</label>
                  <textarea
                    value={appSettings.org_address}
                    onChange={(e) => setAppSettings({ ...appSettings, org_address: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                    rows={2}
                  />
                </div>
              </div>

              {/* Time thresholds */}
              <div className="border-t border-slate-50 pt-5 space-y-4">
                <h4 className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                  <Clock size={16} className="text-slate-450" />
                  <span>Attendance Limits</span>
                </h4>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-450 uppercase tracking-wide">Work Start</label>
                    <input
                      type="time"
                      value={appSettings.work_start}
                      onChange={(e) => setAppSettings({ ...appSettings, work_start: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-450 uppercase tracking-wide">Present Cutoff</label>
                    <input
                      type="time"
                      value={appSettings.present_cutoff}
                      onChange={(e) => setAppSettings({ ...appSettings, present_cutoff: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-450 uppercase tracking-wide">Late Cutoff</label>
                    <input
                      type="time"
                      value={appSettings.late_cutoff}
                      onChange={(e) => setAppSettings({ ...appSettings, late_cutoff: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400">
                  Logs before "Present Cutoff" are marked Present. Logs after that but before "Late Cutoff" are marked Late. Logs after the late cutoff are marked Absent.
                </p>
              </div>

              {/* Working days */}
              <div className="border-t border-slate-50 pt-5 space-y-3">
                <label className="text-xs font-semibold text-slate-450 uppercase tracking-wide">Active Working Days</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {daysOfWeek.map((day) => {
                    const isChecked = Array.isArray(appSettings.working_days) && appSettings.working_days.includes(day.value)
                    return (
                      <label key={day.value} className="flex items-center gap-2 cursor-pointer select-none rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleDayCheckboxChange(day.value)}
                          className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                        />
                        <span>{day.name.substring(0, 3)}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-50">
                <button
                  type="submit"
                  className="flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-bold text-black shadow-md hover:bg-sky-600 transition active:scale-95"
                >
                  <Save size={16} />
                  <span>Save Profile Rules</span>
                </button>
              </div>
            </form>
          )}

          {activeTab === 'security' && (
            <form onSubmit={handlePasswordSave} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-lg space-y-6">
              <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
                <Lock size={18} className="text-sky-500" />
                <span>Change Admin Password</span>
              </h3>

              {passwordStatus.message && (
                <div className={`flex items-center gap-2 rounded-xl border p-4 text-sm ${
                  passwordStatus.type === 'success'
                    ? 'border-emerald-500/20 bg-emerald-50/50 text-emerald-600'
                    : 'border-red-500/20 bg-red-50/50 text-red-650'
                }`}>
                  {passwordStatus.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                  <span>{passwordStatus.message}</span>
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-450 uppercase tracking-wide">Current Password</label>
                  <input
                    type="password"
                    required
                    value={passwordForm.oldPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-450 uppercase tracking-wide">New Password</label>
                    <input
                      type="password"
                      required
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-450 uppercase tracking-wide">Confirm New Password</label>
                    <input
                      type="password"
                      required
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-50">
                <button
                  type="submit"
                  className="flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-bold text-black shadow-md hover:bg-sky-600 transition active:scale-95"
                >
                  <Lock size={16} />
                  <span>Update Password</span>
                </button>
              </div>
            </form>
          )}

          {activeTab === 'filters' && (
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-lg space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <SlidersHorizontal size={18} className="text-sky-500" />
                  <span>Dynamic Spreadsheet Filters</span>
                </h3>
                <button
                  onClick={handleOpenAddFilter}
                  className="flex items-center gap-1.5 rounded-xl bg-sky-500 px-3.5 py-2 text-xs font-bold text-black shadow-sm hover:bg-sky-600 transition active:scale-95"
                >
                  <Plus size={14} />
                  <span>Add Filter</span>
                </button>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                Configure filter inputs that appear on the <strong>Analytics</strong> dashboard when searching through imported spreadsheets (Excel/CSV). The <strong>Column Header Key</strong> must match the column header in the Excel file exactly (case-sensitive) to correctly parse data.
              </p>

              {filters.length === 0 ? (
                <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 text-slate-400">
                  <Sliders size={32} className="stroke-1 animate-pulse" />
                  <p className="mt-2 text-xs">No dynamic filters configured yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 font-bold uppercase tracking-wider text-slate-450">
                        <th className="py-2 px-3">Order</th>
                        <th className="py-2 px-3">Filter Name</th>
                        <th className="py-2 px-3">Column Key</th>
                        <th className="py-2 px-3">Type</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-slate-700">
                      {filters.map((filter) => (
                        <tr key={filter.id} className="hover:bg-slate-50 transition-all">
                          <td className="py-2 px-3 font-mono font-bold text-slate-400">{filter.display_order}</td>
                          <td className="py-2 px-3 font-semibold text-slate-800">{filter.filter_name}</td>
                          <td className="py-2 px-3 font-mono text-sky-600">{filter.column_key}</td>
                          <td className="py-2 px-3">
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 uppercase">
                              {(filter.filter_type || '').replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <StatusBadge status={filter.status} />
                          </td>
                          <td className="py-2 px-3 text-right">
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenEditFilter(filter)}
                                className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-sky-600 transition"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => handleOpenDeleteFilter(filter)}
                                className="rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-650 transition"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Filter Modal */}
      <Modal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        title={filterModalMode === 'add' ? 'Add Filter Definition' : 'Edit Filter Definition'}
      >
        <form onSubmit={handleFilterFormSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Filter Display Name *</label>
              <input
                type="text"
                required
                value={filterFormData.filter_name}
                onChange={(e) => setFilterFormData({ ...filterFormData, filter_name: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                placeholder="e.g. Total Weight"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Column Header Key *</label>
              <input
                type="text"
                required
                value={filterFormData.column_key}
                onChange={(e) => setFilterFormData({ ...filterFormData, column_key: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                placeholder="e.g. weight_kg"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Filter Type</label>
              <select
                value={filterFormData.filter_type}
                onChange={(e) => setFilterFormData({ ...filterFormData, filter_type: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
              >
                <option value="contains">Contains (Text search)</option>
                <option value="exact_match">Exact Match (Text/Code)</option>
                <option value="number_range">Numeric Range (Min/Max)</option>
                <option value="date_range">Date Range (Start/End)</option>
                <option value="dropdown">Dropdown Options</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Display Order</label>
              <input
                type="number"
                value={filterFormData.display_order}
                onChange={(e) => setFilterFormData({ ...filterFormData, display_order: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
              />
            </div>
          </div>

          {filterFormData.filter_type === 'dropdown' && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Dropdown Options (one per line)</label>
              <textarea
                value={filterFormData.options_raw}
                onChange={(e) => setFilterFormData({ ...filterFormData, options_raw: e.target.value })}
                placeholder="Option A&#10;Option B&#10;Option C"
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                rows={4}
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600">Status</label>
            <select
              value={filterFormData.status}
              onChange={(e) => setFilterFormData({ ...filterFormData, status: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsFilterModalOpen(false)}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-bold text-black shadow-md hover:bg-sky-600 transition"
            >
              Save Definition
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={isConfirmDeleteOpen}
        onClose={() => setIsConfirmDeleteOpen(false)}
        onConfirm={handleConfirmDeleteFilter}
        title="Delete Filter Definition"
        message={`Are you sure you want to delete "${filterToDelete?.filter_name}"? This will remove this filter field option from the Data Analytics dashboard.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  )
}
