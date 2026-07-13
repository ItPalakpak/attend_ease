import React, { useState, useEffect } from 'react'
import { Download, FileText, Table, CheckCircle, Clock, XCircle, AlertCircle } from 'lucide-react'
import { DateRangePicker } from '../shared/DateRangePicker'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import Pagination from '../components/ui/Pagination'

export default function ReportsPage() {
  const [dateFrom, setDateFrom] = useState(() => new Date().toISOString().split('T')[0])
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])

  const [records, setRecords] = useState([])
  const [summary, setSummary] = useState({ present: 0, late: 0, absent: 0, total: 0 })
  const [isLoading, setIsLoading] = useState(false)
  const [settings, setSettings] = useState({ org_name: 'AttendEase' })

  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)

  // Fetch settings once
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const s = await window.api.getSettings()
        if (s) setSettings(s)
      } catch (e) {
        console.error('Failed to load settings:', e)
      }
    }
    fetchSettings()
  }, [])

  const generateReport = async () => {
    setIsLoading(true)
    try {
      const data = await window.api.getAttendanceRange({ startDate: dateFrom, endDate: dateTo })

      setRecords(data || [])
      setCurrentPage(1)

      // Calculate Summary
      let present = 0
      let late = 0
      let absent = 0
      ;(data || []).forEach((r) => {
        if (r.status === 'Present') present++
        else if (r.status === 'Late') late++
        else if (r.status === 'Absent') absent++
      })

      setSummary({
        present,
        late,
        absent,
        total: (data || []).length
      })
    } catch (err) {
      console.error('Failed to generate report data:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    generateReport()
  }, [dateFrom, dateTo])

  // Helper: Convert records to exportable format
  const getExportData = () => {
    return records.map((r) => ({
      Date: r.date,
      'Staff ID': r.formatted_id || r.staff_id,
      'Employee Name': `${r.first_name} ${r.last_name}`,
      Department: r.department_name || 'N/A',
      Position: r.role_name || 'N/A',
      'Time In': r.time_in || '--:--',
      'Time Out': r.time_out || '--:--',
      Status: r.status
    }))
  }

  const handleExportExcel = async () => {
    if (records.length === 0) return

    try {
      const defaultFilename = `attendance_report_${dateFrom}_to_${dateTo}.xlsx`
      const fileDialogRes = await window.api.saveFileDialog({
        title: 'Export Excel Report',
        defaultPath: defaultFilename,
        filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }]
      })

      // Handle both return types: electron dialog returns { filePath, canceled }
      const targetPath = typeof fileDialogRes === 'object' ? fileDialogRes.filePath : fileDialogRes
      const isCanceled = typeof fileDialogRes === 'object' ? fileDialogRes.canceled : !targetPath

      if (isCanceled || !targetPath) return

      // Create sheet
      const ws = XLSX.utils.json_to_sheet(getExportData())
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Attendance')

      XLSX.writeFile(wb, targetPath)
      alert(`Report exported successfully to:\n${targetPath}`)
    } catch (err) {
      console.error('Failed to export Excel:', err)
      alert('Failed to export Excel report.')
    }
  }

  const handleExportCSV = async () => {
    if (records.length === 0) return

    try {
      const defaultFilename = `attendance_report_${dateFrom}_to_${dateTo}.csv`
      const fileDialogRes = await window.api.saveFileDialog({
        title: 'Export CSV Report',
        defaultPath: defaultFilename,
        filters: [{ name: 'CSV File', extensions: ['csv'] }]
      })

      const targetPath = typeof fileDialogRes === 'object' ? fileDialogRes.filePath : fileDialogRes
      const isCanceled = typeof fileDialogRes === 'object' ? fileDialogRes.canceled : !targetPath

      if (isCanceled || !targetPath) return

      const ws = XLSX.utils.json_to_sheet(getExportData())
      const csvOutput = XLSX.utils.sheet_to_csv(ws)

      // Use a hidden downloader
      const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = targetPath.split(/[\\/]/).pop() // Extract base name
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      console.error(err)
      alert('Failed to export CSV.')
    }
  }

  const handleExportPDF = async () => {
    if (records.length === 0) return

    try {
      const defaultFilename = `attendance_report_${dateFrom}_to_${dateTo}.pdf`
      const fileDialogRes = await window.api.saveFileDialog({
        title: 'Export PDF Report',
        defaultPath: defaultFilename,
        filters: [{ name: 'PDF Document', extensions: ['pdf'] }]
      })

      const targetPath = typeof fileDialogRes === 'object' ? fileDialogRes.filePath : fileDialogRes
      const isCanceled = typeof fileDialogRes === 'object' ? fileDialogRes.canceled : !targetPath

      if (isCanceled || !targetPath) return

      // Create PDF
      const doc = new jsPDF()

      // Title Section
      doc.setFont('Helvetica', 'bold')
      doc.setFontSize(18)
      doc.text(settings.org_name.toUpperCase(), 14, 20)

      doc.setFontSize(12)
      doc.setFont('Helvetica', 'normal')
      doc.text('Attendance Report', 14, 28)
      doc.text(`Period: ${dateFrom} to ${dateTo}`, 14, 34)
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 40)

      // Divider
      doc.setDrawColor(226, 232, 240)
      doc.line(14, 44, 196, 44)

      // Stats Section
      doc.setFont('Helvetica', 'bold')
      doc.setFontSize(10)
      doc.text('SUMMARY:', 14, 52)
      doc.setFont('Helvetica', 'normal')
      doc.text(`Total Records: ${summary.total}`, 14, 58)
      doc.text(`Present: ${summary.present}`, 60, 58)
      doc.text(`Late: ${summary.late}`, 100, 58)
      doc.text(`Absent: ${summary.absent}`, 140, 58)

      doc.line(14, 64, 196, 64)

      // Draw simple custom table
      let y = 74
      doc.setFont('Helvetica', 'bold')
      doc.text('Name', 14, 70)
      doc.text('ID', 60, 70)
      doc.text('Position', 90, 70)
      doc.text('Date', 130, 70)
      doc.text('In / Out', 158, 70)
      doc.text('Status', 185, 70)

      doc.setFont('Helvetica', 'normal')
      records.forEach((r) => {
        // Add page if needed
        if (y > 280) {
          doc.addPage()
          y = 20
        }

        const name = `${r.first_name} ${r.last_name}`
        doc.text(name.substring(0, 22), 14, y)
        doc.text((r.formatted_id || r.staff_id).substring(0, 14), 60, y)
        doc.text((r.role_name || '').substring(0, 18), 90, y)
        doc.text(r.date || '', 130, y)
        doc.text(`${r.time_in || '--:--'} / ${r.time_out || '--:--'}`, 158, y)
        doc.text(r.status, 185, y)

        y += 7
      })

      // Download PDF in browser renderer
      doc.save(targetPath.split(/[\\/]/).pop())
      alert(`Report exported successfully to:\n${targetPath}`)
    } catch (err) {
      console.error(err)
      alert('Failed to generate PDF report.')
    }
  }

  // Pagination Math
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedRecords = records.slice(startIndex, endIndex)

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden space-y-4 pb-2 pr-2">
      {/* Selectors Panel */}
      <div className="shrink-0 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between">
          <DateRangePicker
            dateFrom={dateFrom}
            dateTo={dateTo}
            onChange={({ dateFrom: from, dateTo: to }) => {
              setDateFrom(from)
              setDateTo(to)
            }}
          />

          {/* Export Actions */}
          {records.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
              >
                <Download size={14} />
                <span>Excel</span>
              </button>
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
              >
                <Download size={14} />
                <span>CSV</span>
              </button>
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-1.5 rounded-xl bg-sky-500 px-4 py-1.5 text-xs font-bold text-black shadow-md transition hover:bg-sky-600 active:scale-95"
              >
                <FileText size={14} />
                <span>Export PDF</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="shrink-0 grid grid-cols-1 gap-5 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm flex items-center gap-4">
          <div className="rounded-xl bg-sky-50 p-2.5 text-sky-500">
            <Table size={20} />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Total Entries
            </p>
            <p className="text-lg font-bold text-slate-800 mt-0.5">{summary.total}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm flex items-center gap-4">
          <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-500">
            <CheckCircle size={20} />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Present
            </p>
            <p className="text-lg font-bold text-slate-800 mt-0.5">{summary.present}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm flex items-center gap-4">
          <div className="rounded-xl bg-amber-50 p-2.5 text-amber-500">
            <Clock size={20} />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Late Entries
            </p>
            <p className="text-lg font-bold text-slate-800 mt-0.5">{summary.late}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm flex items-center gap-4">
          <div className="rounded-xl bg-rose-50 p-2.5 text-rose-500">
            <XCircle size={20} />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Absent Entries
            </p>
            <p className="text-lg font-bold text-slate-800 mt-0.5">{summary.absent}</p>
          </div>
        </div>
      </div>

      {/* Preview Table */}
      <div className="flex-1 min-h-0 rounded-2xl border border-slate-100 bg-white p-5 shadow-lg flex flex-col overflow-hidden">
        <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 mb-3 shrink-0">
          Report Preview
        </h3>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-sky-500" />
          </div>
        ) : records.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 text-slate-400">
            <AlertCircle size={36} className="stroke-1" />
            <p className="mt-2 text-sm">No records to preview for selected period.</p>
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
                    <th className="py-2.5 px-3 bg-white">Department</th>
                    <th className="py-2.5 px-3 bg-white">Position</th>
                    <th className="py-2.5 px-3 bg-white">Time In</th>
                    <th className="py-2.5 px-3 bg-white">Time Out</th>
                    <th className="py-2.5 px-3 bg-white">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-slate-700">
                  {paginatedRecords.map((r, index) => (
                    <tr key={index} className="hover:bg-slate-50/50 transition-all">
                      <td className="py-2 px-3 font-semibold text-slate-650">{r.date}</td>
                      <td className="py-2 px-3 font-mono text-[10px] text-slate-500">
                        {r.formatted_id || r.staff_id}
                      </td>
                      <td className="py-2 px-3 font-bold text-slate-800">
                        {r.first_name} {r.last_name}
                      </td>
                      <td className="py-2 px-3 text-slate-500">{r.department_name}</td>
                      <td className="py-2 px-3 text-slate-500">{r.role_name}</td>
                      <td className="py-2 px-3 font-mono text-[10px]">{r.time_in || '--:--'}</td>
                      <td className="py-2 px-3 font-mono text-[10px]">{r.time_out || '--:--'}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                            r.status === 'Present'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              : r.status === 'Late'
                                ? 'bg-amber-50 text-amber-700 border border-amber-100'
                                : 'bg-rose-50 text-rose-700 border border-rose-100'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={currentPage}
              totalItems={records.length}
              itemsPerPage={itemsPerPage}
              onChangePage={setCurrentPage}
              onChangeItemsPerPage={setItemsPerPage}
            />
          </>
        )}
      </div>
    </div>
  )
}
