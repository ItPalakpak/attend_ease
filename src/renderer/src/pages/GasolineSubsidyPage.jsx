import React, { useState, useEffect, useMemo } from 'react'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Pagination from '../components/ui/Pagination'
import {
  Fuel,
  Settings,
  Plus,
  Trash2,
  Download,
  Upload,
  DollarSign,
  TrendingUp,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Info
} from 'lucide-react'
import { DateRangePicker } from '../shared/DateRangePicker'

// Helper: Calculate week range starting Monday, ending Sunday
function getWeekRange(dateStr) {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return { start: '', end: '' }
  const day = date.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(date)
  monday.setDate(date.getDate() + diffToMonday)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0]
  }
}

// Helper: Get human-readable date format (e.g. "Monday, July 6, 2026")
function getReadableDate(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

export default function GasolineSubsidyPage() {
  const [subsidies, setSubsidies] = useState([])
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(15)
  const [staffList, setStaffList] = useState([])
  const [settings, setSettings] = useState({
    gasoline_price: '80',
    gasoline_discount: '0.6',
    gasoline_weekly_limit: '3'
  })

  // Date range filter (defaults to current week)
  const [dateFrom, setDateFrom] = useState(
    () => getWeekRange(new Date().toISOString().split('T')[0]).start
  )
  const [dateTo, setDateTo] = useState(
    () => getWeekRange(new Date().toISOString().split('T')[0]).end
  )

  // Form states
  const [formStaffId, setFormStaffId] = useState('')
  const [formLiters, setFormLiters] = useState('1')
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])
  const [formStatus, setFormStatus] = useState('PAID') // 'PAID' or 'unpaid'
  const [formIsPromo, setFormIsPromo] = useState(false)

  // Confirmation states
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [isLimitConfirmOpen, setIsLimitConfirmOpen] = useState(false)
  const [pendingSavePayload, setPendingSavePayload] = useState(null)
  const [limitWarningMessage, setLimitWarningMessage] = useState('')

  // Settings form states
  const [editPrice, setEditPrice] = useState('80')
  const [editDiscount, setEditDiscount] = useState('60')
  const [editLimit, setEditLimit] = useState('3')
  const [showSettings, setShowSettings] = useState(false)

  // Status message states
  const [message, setMessage] = useState(null) // { type: 'success'|'error', text: '' }

  // Load initial data
  const loadData = async () => {
    try {
      const activeSettings = await window.api.getSettings()
      if (activeSettings.gasoline_price) {
        setSettings({
          gasoline_price: activeSettings.gasoline_price,
          gasoline_discount: activeSettings.gasoline_discount,
          gasoline_weekly_limit: activeSettings.gasoline_weekly_limit
        })
        setEditPrice(activeSettings.gasoline_price)
        setEditDiscount(String(parseFloat(activeSettings.gasoline_discount) * 100))
        setEditLimit(activeSettings.gasoline_weekly_limit)
      }

      const list = await window.api.getStaffList()
      // Filter only active staff members
      setStaffList(list?.filter((s) => s.employment_status === 'Active') || [])

      const records = await window.api.getGasolineSubsidies({
        startDate: dateFrom,
        endDate: dateTo
      })
      setSubsidies(records || [])
      setCurrentPage(1)
    } catch (err) {
      console.error('Failed to load data:', err)
      showStatus('error', 'Failed to load gasoline subsidy data.')
    }
  }

  useEffect(() => {
    loadData()
  }, [dateFrom, dateTo])

  const showStatus = (type, text) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 5000)
  }

  // Settings Updater
  const handleUpdateSettings = async (e) => {
    e.preventDefault()
    try {
      const price = parseFloat(editPrice)
      const discount = parseFloat(editDiscount) / 100
      const limit = parseFloat(editLimit)

      if (
        isNaN(price) ||
        isNaN(discount) ||
        isNaN(limit) ||
        price <= 0 ||
        discount < 0 ||
        limit <= 0
      ) {
        showStatus('error', 'Please provide valid positive numbers.')
        return
      }

      const res = await window.api.updateSettings({
        gasoline_price: String(price),
        gasoline_discount: String(discount),
        gasoline_weekly_limit: String(limit)
      })

      if (res.success) {
        setSettings({
          gasoline_price: String(price),
          gasoline_discount: String(discount),
          gasoline_weekly_limit: String(limit)
        })
        setShowSettings(false)
        showStatus('success', 'Gasoline settings updated successfully.')
        loadData()
      } else {
        showStatus('error', res.message || 'Failed to update settings.')
      }
    } catch (err) {
      showStatus('error', 'An error occurred while saving settings.')
    }
  }

  // Create/Log Entry
  const handleCreateEntry = async (e) => {
    e.preventDefault()
    if (!formStaffId) {
      showStatus('error', 'Please select an employee.')
      return
    }

    const liters = parseFloat(formLiters)
    if (isNaN(liters) || liters <= 0) {
      showStatus('error', 'Please enter a valid amount of liters.')
      return
    }

    try {
      // Calculate current remaining limit for selected rider in selected date's week
      const currentUsage = await window.api.getWeeklyGasolineUsage({
        staffId: parseInt(formStaffId),
        dateStr: formDate
      })
      const limit = parseFloat(settings.gasoline_weekly_limit)

      if (!formIsPromo && currentUsage + liters > limit) {
        // Warn/Ask or Cap it. Open custom ConfirmDialog instead of window.confirm
        setLimitWarningMessage(
          `Rider already used ${currentUsage}L this week. Logged transaction will exceed the limit of ${limit}L by ${currentUsage + liters - limit}L. Proceed?`
        )
        setPendingSavePayload({
          staff_id: parseInt(formStaffId),
          liters: liters,
          date: formDate,
          status: formStatus,
          is_promo: formIsPromo
        })
        setIsLimitConfirmOpen(true)
        return
      }

      const res = await window.api.saveGasolineEntry({
        staff_id: parseInt(formStaffId),
        liters: liters,
        date: formDate,
        status: formStatus,
        is_promo: formIsPromo
      })

      if (res.success) {
        showStatus('success', 'Subsidy entry logged successfully.')
        setFormLiters('1')
        setFormIsPromo(false)
        loadData()
      } else {
        showStatus('error', res.message || 'Failed to save entry.')
      }
    } catch (err) {
      showStatus('error', 'Failed to save entry.')
    }
  }

  const handleConfirmLimitSave = async () => {
    if (!pendingSavePayload) return
    try {
      const res = await window.api.saveGasolineEntry(pendingSavePayload)
      if (res.success) {
        showStatus('success', 'Subsidy entry logged successfully.')
        setFormLiters('1')
        setFormIsPromo(false)
        loadData()
      } else {
        showStatus('error', res.message || 'Failed to save entry.')
      }
    } catch (err) {
      showStatus('error', 'Failed to save entry.')
    } finally {
      setPendingSavePayload(null)
    }
  }

  // Toggle paid/unpaid status
  const handleToggleStatus = async (item) => {
    try {
      const newStatus = item.status === 'PAID' ? 'unpaid' : 'PAID'
      const res = await window.api.saveGasolineEntry({
        ...item,
        status: newStatus
      })
      if (res.success) {
        loadData()
      }
    } catch (err) {
      showStatus('error', 'Failed to update payment status.')
    }
  }

  // Delete Entry
  const handleDelete = (id) => {
    setDeleteId(id)
    setIsDeleteConfirmOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!deleteId) return
    try {
      const res = await window.api.deleteGasolineEntry(deleteId)
      if (res.success) {
        showStatus('success', 'Entry deleted successfully.')
        loadData()
      } else {
        showStatus('error', res.message)
      }
    } catch (err) {
      showStatus('error', 'Failed to delete entry.')
    } finally {
      setDeleteId(null)
    }
  }

  // Excel Import Dialog
  const handleImportExcel = async () => {
    try {
      const fileRes = await window.api.openFileDialog({
        properties: ['openFile'],
        filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
      })

      if (fileRes.canceled || fileRes.filePaths.length === 0) return

      const res = await window.api.importGasolineExcel(fileRes.filePaths[0])
      if (res.success) {
        showStatus(
          'success',
          `Excel imported successfully. Seeded: ${res.imported} logs, Skipped/Duplicates: ${res.skipped} logs.`
        )
        loadData()
      } else {
        showStatus('error', res.message || 'Excel import failed.')
      }
    } catch (err) {
      console.error(err)
      showStatus('error', 'Failed to parse/import Excel file.')
    }
  }

  // Live Copay Calculations (Rider & Employer)
  const previewCalculation = useMemo(() => {
    const liters = parseFloat(formLiters) || 0
    const price = parseFloat(settings.gasoline_price) || 80
    const discount = parseFloat(settings.gasoline_discount) || 0.6

    if (formIsPromo) {
      return {
        riderPays: 0,
        employerPays: liters * price,
        isPromo: true
      }
    }

    const riderPays = liters * (price * (1 - discount))
    const employerPays = formStatus === 'PAID' ? liters * (price * discount) : liters * price
    return {
      riderPays,
      employerPays,
      isPromo: false
    }
  }, [formLiters, formStatus, formIsPromo, settings])

  // Total summary aggregates for the active week
  const aggregates = useMemo(() => {
    let totalLiters = 0
    let totalEmployerPayable = 0
    let totalRiderPaid = 0
    let totalRiderDebt = 0
    let promoCount = 0

    subsidies.forEach((item) => {
      const liters = parseFloat(item.liters) || 0
      totalLiters += liters

      totalEmployerPayable += parseFloat(item.subsidy) || 0

      if (item.is_promo) {
        promoCount++
      } else {
        const amount = parseFloat(item.amount) || 0
        if (item.status === 'PAID') {
          totalRiderPaid += amount
        } else {
          totalRiderDebt += amount
        }
      }
    })

    return {
      totalLiters,
      totalEmployerPayable,
      totalRiderPaid,
      totalRiderDebt,
      promoCount
    }
  }, [subsidies])

  // Pagination Math
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedSubsidies = subsidies.slice(startIndex, endIndex)

  return (
    <div className="h-[calc(100vh-186px)] flex flex-col overflow-hidden space-y-4 pb-2 pr-2">
      {/* Global alert messages (static) */}
      {message && (
        <div
          className={`shrink-0 flex items-center gap-3 rounded-xl p-4 text-xs font-semibold shadow-md border animate-fade-in ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
              : 'bg-red-50 text-red-800 border-red-100'
          }`}
        >
          {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {message.text}
        </div>
      )}

      {/* Settings Panel (static) */}
      {showSettings && (
        <form
          onSubmit={handleUpdateSettings}
          className="shrink-0 rounded-2xl border border-slate-100 bg-white p-5 shadow-lg space-y-4 animate-fade-in"
        >
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-700">Update Dynamic Parameters</h3>
            <span className="text-[10px] bg-slate-100 text-slate-500 rounded px-2 py-0.5 font-bold uppercase">
              GLOBAL
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="text-xs font-bold text-slate-500">
                Gasoline Price (PHP / Liter)
              </label>
              <input
                type="number"
                step="0.01"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none transition focus:border-sky-500 focus:bg-white"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500">Discount Rate (%)</label>
              <input
                type="number"
                value={editDiscount}
                onChange={(e) => setEditDiscount(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none transition focus:border-sky-500 focus:bg-white"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500">
                Weekly Limit (Liters / Rider)
              </label>
              <input
                type="number"
                step="0.5"
                value={editLimit}
                onChange={(e) => setEditLimit(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none transition focus:border-sky-500 focus:bg-white"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-650 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-sky-500 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-sky-650 active:scale-95"
            >
              Save Parameters
            </button>
          </div>
        </form>
      )}

      {/* Date Range & Actions */}
      <div className="shrink-0 flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <DateRangePicker
          dateFrom={dateFrom}
          dateTo={dateTo}
          onChange={({ dateFrom: from, dateTo: to }) => {
            setDateFrom(from)
            setDateTo(to)
          }}
        />

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            data-tooltip="Parameters"
            data-tooltip-pos="bottom"
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-sky-500"
          >
            <Settings size={14} />
            Parameters
          </button>

          <button
            type="button"
            onClick={handleImportExcel}
            data-tooltip="Import Excel"
            data-tooltip-pos="bottom"
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-emerald-600"
          >
            <Download size={14} />
            Import Excel
          </button>
        </div>
      </div>

      {/* Weekly KPI Aggregates (static) */}
      <div className="shrink-0 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {/* Total Liters */}
        <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 h-full w-1.5 bg-sky-500" />
          <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">
            Total Consumed
          </p>
          <p className="text-xl font-black text-slate-800 font-mono mt-0.5">
            {aggregates.totalLiters.toFixed(1)}{' '}
            <span className="text-[10px] font-bold text-slate-400">Liters</span>
          </p>
        </div>

        {/* Employer Payout */}
        <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 h-full w-1.5 bg-violet-500" />
          <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">
            Employer Payable
          </p>
          <p className="text-xl font-black text-slate-800 font-mono mt-0.5">
            ₱
            {aggregates.totalEmployerPayable.toLocaleString(undefined, {
              minimumFractionDigits: 2
            })}
          </p>
        </div>

        {/* Rider Contribution */}
        <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 h-full w-1.5 bg-emerald-500" />
          <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">
            Rider Copay (Paid)
          </p>
          <p className="text-xl font-black text-slate-800 font-mono mt-0.5">
            ₱{aggregates.totalRiderPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>

        {/* Rider Outstanding Debt */}
        <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 h-full w-1.5 bg-amber-500" />
          <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">
            Rider Debt (Unpaid)
          </p>
          <p className="text-xl font-black text-slate-800 font-mono mt-0.5">
            ₱{aggregates.totalRiderDebt.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Main content grid (flexible height container) */}
      <div className="flex-1 min-h-0 grid grid-cols-1 gap-6 lg:grid-cols-12 overflow-hidden pb-1 pr-1">
        {/* Left column: Transaction Logger Form (scrolls internally if needed) */}
        <div className="lg:col-span-4 rounded-2xl border border-slate-100 bg-white shadow-md flex flex-col h-full max-h-full">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2 shrink-0">
              <Plus className="text-sky-500" size={16} />
              <h2 className="text-xs font-bold text-slate-700">Log Transaction</h2>
            </div>

            <form onSubmit={handleCreateEntry} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500">Select Rider</label>
                <select
                  value={formStaffId}
                  onChange={(e) => setFormStaffId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs outline-none transition focus:border-sky-500 focus:bg-white"
                >
                  <option value="">-- Select Courier --</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {s.first_name} {s.last_name} ({s.employee_number || s.staff_id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500">Liters</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formLiters}
                    onChange={(e) => setFormLiters(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs outline-none transition focus:border-sky-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500">Date</label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    title=""
                    data-tooltip="Select Log Date"
                    data-tooltip-pos="bottom"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs outline-none transition focus:border-sky-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500">Rider Copay Status</label>
                  <select
                    value={formStatus}
                    disabled={formIsPromo}
                    onChange={(e) => setFormStatus(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs outline-none transition focus:border-sky-500 focus:bg-white"
                  >
                    <option value="PAID">PAID</option>
                    <option value="unpaid">Unpaid</option>
                  </select>
                </div>

                <div className="flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-transparent select-none">Promo</span>
                  <label className="flex items-center gap-2 cursor-pointer py-1.5 text-[10px] font-bold text-slate-650 border border-slate-200 bg-slate-50 px-2.5 rounded-xl transition hover:bg-slate-100/50 mt-1 h-[29px]">
                    <input
                      type="checkbox"
                      checked={formIsPromo}
                      onChange={(e) => setFormIsPromo(e.target.checked)}
                      className="h-3.5 w-3.5 border-slate-300 text-sky-500 focus:ring-sky-400"
                    />
                    Free 1L Promo
                  </label>
                </div>
              </div>

              {/* Calculations preview box */}
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-100 space-y-1.5">
                <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 border-b border-slate-200/50 pb-1">
                  <span>ESTIMATED VALUES</span>
                  <span>(Rate: ₱{settings.gasoline_price}/L)</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 font-semibold">Rider Copay:</span>
                  <span className="font-bold text-slate-800 font-mono">
                    ₱{previewCalculation.riderPays.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 font-semibold">Employer Payout:</span>
                  <span className="font-bold text-slate-800 font-mono">
                    ₱{previewCalculation.employerPays.toFixed(2)}
                  </span>
                </div>
                {previewCalculation.isPromo && (
                  <div className="flex items-center gap-1 text-[9px] font-extrabold text-violet-600 bg-violet-50 border border-violet-100 rounded px-1.5 py-0.5 mt-0.5">
                    <Info size={9} />
                    Promotional liter excluded from limits
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-sky-500 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-sky-650 active:scale-95"
              >
                Log Transaction
              </button>
            </form>
          </div>
        </div>

        {/* Right column: Transactions Table Log (occupies full height, table body scrolls internally) */}
        <div className="lg:col-span-8 flex flex-col h-full overflow-hidden pb-1 pr-1">
          <div className="flex flex-col h-full border border-slate-100 bg-white shadow-md rounded-2xl">
            {/* Table Header (static) */}
            <div className="shrink-0 py-3 px-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-xs font-bold text-slate-700 flex items-center gap-2">
                <FileSpreadsheet className="text-slate-400" size={14} />
                Filtered Logs ({subsidies.length} entries)
              </h2>

              <span className="text-[9px] font-bold text-slate-400 font-mono">
                Limit: {settings.gasoline_weekly_limit}L / week
              </span>
            </div>

            {/* Scrollable Table Area */}
            <div className="flex-1 overflow-y-auto overflow-x-auto">
              {subsidies.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-slate-400 h-full">
                  <Fuel size={48} className="stroke-1 text-slate-300 animate-pulse mb-3" />
                  <p className="text-xs font-bold">No transactions logged for this week.</p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Use the left form to log one, or import an Excel spreadsheet.
                  </p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-slate-400 font-bold uppercase tracking-wider text-[9px] sticky top-0 z-10 shadow-sm">
                      <th className="py-2.5 px-3 bg-slate-50">Rider / Employee</th>
                      <th className="py-2.5 px-3 bg-slate-50">Date</th>
                      <th className="py-2.5 px-3 bg-slate-50 text-center">Liters</th>
                      <th className="py-2.5 px-3 bg-slate-50 text-right">Rider Portion</th>
                      <th className="py-2.5 px-3 bg-slate-50 text-center">Status</th>
                      <th className="py-2.5 px-3 bg-slate-50 text-right">Employer Payable</th>
                      <th className="py-2.5 px-3 bg-slate-50 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {paginatedSubsidies.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition duration-150">
                        <td className="py-2.5 px-3">
                          <p className="font-bold text-slate-800">{item.rider_name}</p>
                          <p className="text-[9px] text-slate-400 uppercase tracking-widest mt-0.5">
                            ID: {item.formatted_staff_id}
                          </p>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap text-slate-500">
                          {item.date}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold font-mono">
                          {parseFloat(item.liters)}
                          {item.is_promo === 1 && (
                            <span className="ml-1 text-[8px] bg-violet-50 text-violet-700 border border-violet-100 rounded px-1 py-0.5 font-bold uppercase">
                              PROMO
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
                          ₱{parseFloat(item.amount).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => handleToggleStatus(item)}
                            disabled={item.is_promo === 1}
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider transition ${
                              item.is_promo === 1
                                ? 'bg-violet-50 text-violet-600 border border-violet-100 cursor-default'
                                : item.status === 'PAID'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100/50'
                                  : 'bg-red-50 text-red-700 border border-red-100 hover:bg-red-100/50'
                            }`}
                          >
                            {item.is_promo === 1 ? 'FREE' : item.status}
                          </button>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
                          ₱{parseFloat(item.subsidy).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                            data-tooltip="Delete entry"
                            data-tooltip-pos="left"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <Pagination
              currentPage={currentPage}
              totalItems={subsidies.length}
              itemsPerPage={itemsPerPage}
              onChangePage={setCurrentPage}
              onChangeItemsPerPage={setItemsPerPage}
            />

            {/* Table Legend Footer (static) */}
            <div className="shrink-0 py-2.5 px-4 border-t border-slate-100 bg-slate-50/50 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-[9px] text-slate-400">
              <span className="flex items-center gap-1.5 font-bold uppercase">
                <Info size={11} className="text-slate-400" />
                Legend
              </span>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <span>**PAID**: Rider settled copay. Employer pays subsidy (60%)</span>
                <span>**Unpaid**: Rider owes copay. Employer pays full cost (100%) to station</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete log entry"
        message="Are you sure you want to delete this gasoline subsidy log entry? This operation cannot be undone."
        confirmText="Delete entry"
        cancelText="Cancel"
        type="danger"
      />

      {/* Confirm Weekly Limit Exceeded Dialog */}
      <ConfirmDialog
        isOpen={isLimitConfirmOpen}
        onClose={() => setIsLimitConfirmOpen(false)}
        onConfirm={handleConfirmLimitSave}
        title="Weekly Limit Exceeded"
        message={limitWarningMessage}
        confirmText="Proceed"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  )
}
