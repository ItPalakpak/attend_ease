import React, { useState, useEffect } from 'react'
import {
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronLeft,
  ChevronRight,
  FileBarChart
} from 'lucide-react'
import StatusBadge from '../components/ui/StatusBadge'
import { DateRangePicker } from '../shared/DateRangePicker'
import Pagination from '../components/ui/Pagination'

export default function AttendanceHistoryPage() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7) // Default to last 7 days
    return d.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])
  const [searchQuery, setSearchQuery] = useState('')
  const [records, setRecords] = useState([])
  const [filteredRecords, setFilteredRecords] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  // Stats
  const [summaryStats, setSummaryStats] = useState({
    present: 0,
    late: 0,
    absent: 0
  })

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [recordsPerPage, setRecordsPerPage] = useState(15)

  const fetchHistory = async () => {
    setIsLoading(true)
    try {
      const res = await window.api.getAttendanceRange({ startDate, endDate })
      setRecords(res || [])
      setCurrentPage(1)
    } catch (err) {
      console.error('Failed to fetch attendance history:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchHistory()
  }, [startDate, endDate])

  // Filter records locally on search query
  useEffect(() => {
    const q = searchQuery.toLowerCase().trim()
    let filtered = records

    if (q) {
      filtered = records.filter(
        (r) =>
          r.first_name.toLowerCase().includes(q) ||
          r.last_name.toLowerCase().includes(q) ||
          r.formatted_id.toLowerCase().includes(q) ||
          r.staff_id.toLowerCase().includes(q)
      )
    }

    setFilteredRecords(filtered)

    // Calculate Summary Stats
    let present = 0
    let late = 0
    let absent = 0

    filtered.forEach((r) => {
      if (r.status === 'Present') present++
      else if (r.status === 'Late') late++
      else if (r.status === 'Absent') absent++
    })

    setSummaryStats({ present, late, absent })
    setCurrentPage(1)
  }, [records, searchQuery])

  // Pagination Math
  const indexOfLastRecord = currentPage * recordsPerPage
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage
  const currentRecords = filteredRecords.slice(indexOfFirstRecord, indexOfLastRecord)
  const totalPages = Math.ceil(filteredRecords.length / recordsPerPage)

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden space-y-4 pb-2 pr-2">
      {/* Date Range Filter */}
      <div className="shrink-0 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <DateRangePicker
          dateFrom={startDate}
          dateTo={endDate}
          onChange={({ dateFrom, dateTo }) => {
            setStartDate(dateFrom)
            setEndDate(dateTo)
          }}
        />
      </div>

      {/* Stats Cards */}
      <div className="shrink-0 grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm">
          <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Total Present
            </p>
            <p className="text-lg font-bold text-slate-800 mt-0.5">{summaryStats.present}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm">
          <div className="rounded-xl bg-amber-50 p-2.5 text-amber-600">
            <Clock size={20} />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Total Late
            </p>
            <p className="text-lg font-bold text-slate-800 mt-0.5">{summaryStats.late}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm">
          <div className="rounded-xl bg-rose-50 p-2.5 text-rose-600">
            <XCircle size={20} />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Total Absent
            </p>
            <p className="text-lg font-bold text-slate-800 mt-0.5">{summaryStats.absent}</p>
          </div>
        </div>
      </div>

      {/* Table & Search */}
      <div className="flex-1 min-h-0 rounded-2xl border border-slate-100 bg-white p-5 shadow-lg flex flex-col space-y-4 overflow-hidden">
        {/* Search */}
        <div className="relative max-w-md shrink-0">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search size={18} />
          </span>
          <input
            type="text"
            placeholder="Search by staff name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-10 pr-4 text-xs outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
          />
        </div>

        {/* List Table */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-sky-500" />
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 text-slate-400">
            <FileBarChart size={36} className="stroke-1" />
            <p className="mt-2 text-sm">No attendance records found for this period.</p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto overflow-x-auto pb-1 pr-1">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider text-[10px] sticky top-0 bg-white z-10 shadow-sm">
                    <th className="py-2.5 px-3 bg-white">Date</th>
                    <th className="py-2.5 px-3 bg-white">Staff ID</th>
                    <th className="py-2.5 px-3 bg-white">Name</th>
                    <th className="py-2.5 px-3 bg-white">Role / Position</th>
                    <th className="py-2.5 px-3 bg-white">Time In</th>
                    <th className="py-2.5 px-3 bg-white">Time Out</th>
                    <th className="py-2.5 px-3 bg-white">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-slate-700">
                  {currentRecords.map((r, index) => (
                    <tr key={index} className="transition hover:bg-slate-50/50">
                      <td className="py-2 px-3 font-semibold text-slate-700">
                        {r.date
                          ? new Date(r.date).toLocaleDateString(undefined, {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })
                          : 'N/A'}
                      </td>
                      <td className="py-2 px-3 font-mono text-[10px] font-semibold text-slate-500">
                        {r.formatted_id || r.staff_id}
                      </td>
                      <td className="py-2 px-3 font-semibold text-slate-800">
                        {r.first_name} {r.last_name}
                      </td>
                      <td className="py-2 px-3 text-slate-500">{r.role_name || 'Staff'}</td>
                      <td className="py-2 px-3 font-mono text-[10px] font-bold text-slate-650">
                        {r.time_in || '--:--'}
                      </td>
                      <td className="py-2 px-3 font-mono text-[10px] font-bold text-slate-650">
                        {r.time_out || '--:--'}
                      </td>
                      <td className="py-2 px-3">
                        <StatusBadge status={r.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <Pagination
              currentPage={currentPage}
              totalItems={filteredRecords.length}
              itemsPerPage={recordsPerPage}
              onChangePage={setCurrentPage}
              onChangeItemsPerPage={setRecordsPerPage}
            />
          </>
        )}
      </div>
    </div>
  )
}
