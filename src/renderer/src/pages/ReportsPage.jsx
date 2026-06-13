import React, { useState, useEffect } from 'react'
import { Calendar, Download, FileText, Table, CheckCircle, Clock, XCircle, AlertCircle } from 'lucide-react'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'

export default function ReportsPage() {
  const [reportType, setReportType] = useState('daily') // 'daily' or 'monthly'
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0])
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  const [records, setRecords] = useState([])
  const [summary, setSummary] = useState({ present: 0, late: 0, absent: 0, total: 0 })
  const [isLoading, setIsLoading] = useState(false)
  const [settings, setSettings] = useState({ org_name: 'AttendEase' })

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
      let data = []
      if (reportType === 'daily') {
        data = await window.api.getDailyAttendance(selectedDate)
      } else {
        // Monthly report: query range
        const [year, month] = selectedMonth.split('-')
        const startDate = `${year}-${month}-01`
        const lastDay = new Date(Number(year), Number(month), 0).getDate()
        const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`
        data = await window.api.getAttendanceRange({ startDate, endDate })
      }

      setRecords(data || [])

      // Calculate Summary
      let present = 0
      let late = 0
      let absent = 0
      data.forEach((r) => {
        if (r.status === 'Present') present++
        else if (r.status === 'Late') late++
        else if (r.status === 'Absent') absent++
      })

      setSummary({
        present,
        late,
        absent,
        total: data.length
      })
    } catch (err) {
      console.error('Failed to generate report data:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    generateReport()
  }, [reportType, selectedDate, selectedMonth])

  // Helper: Convert records to exportable format
  const getExportData = () => {
    return records.map((r) => {
      if (reportType === 'daily') {
        return {
          'Staff ID': r.formatted_id || r.staff_id,
          'Employee Name': `${r.first_name} ${r.last_name}`,
          'Department': r.department_name || 'N/A',
          'Position': r.role_name || 'N/A',
          'Time In': r.time_in || '--:--',
          'Time Out': r.time_out || '--:--',
          'Status': r.status
        }
      } else {
        return {
          'Date': r.date,
          'Staff ID': r.formatted_id || r.staff_id,
          'Employee Name': `${r.first_name} ${r.last_name}`,
          'Department': r.department_name || 'N/A',
          'Position': r.role_name || 'N/A',
          'Time In': r.time_in || '--:--',
          'Time Out': r.time_out || '--:--',
          'Status': r.status
        }
      }
    })
  }

  const handleExportExcel = async () => {
    if (records.length === 0) return

    try {
      const defaultFilename = `${reportType}_report_${reportType === 'daily' ? selectedDate : selectedMonth}.xlsx`
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

      // Since we don't have fs in renderer, we can write via browser-hack OR we can convert sheet to binary and download.
      // Wait, in Electron, standard file download trigger works beautifully:
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
      const defaultFilename = `${reportType}_report_${reportType === 'daily' ? selectedDate : selectedMonth}.csv`
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
      const defaultFilename = `${reportType}_report_${reportType === 'daily' ? selectedDate : selectedMonth}.pdf`
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
      doc.text(`Attendance Report (${reportType === 'daily' ? 'Daily' : 'Monthly'})`, 14, 28)
      doc.text(`Period: ${reportType === 'daily' ? selectedDate : selectedMonth}`, 14, 34)
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
      doc.text('ID', 70, 70)
      doc.text('Position', 100, 70)
      if (reportType === 'monthly') {
        doc.text('Date', 145, 70)
      } else {
        doc.text('In / Out', 145, 70)
      }
      doc.text('Status', 180, 70)

      doc.setFont('Helvetica', 'normal')
      records.forEach((r, idx) => {
        // Add page if needed
        if (y > 280) {
          doc.addPage()
          y = 20
        }

        const name = `${r.first_name} ${r.last_name}`
        doc.text(name.substring(0, 26), 14, y)
        doc.text(r.formatted_id || r.staff_id, 70, y)
        doc.text((r.role_name || '').substring(0, 20), 100, y)
        if (reportType === 'monthly') {
          doc.text(r.date || '', 145, y)
        } else {
          doc.text(`${r.time_in || '--:--'} / ${r.time_out || '--:--'}`, 145, y)
        }
        doc.text(r.status, 180, y)

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Attendance Reports</h1>
          <p className="text-sm text-slate-500">Generate, view, and export organization attendance metrics</p>
        </div>
      </div>

      {/* Selectors Panel */}
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end justify-between">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Type */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Report Type</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="w-40 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
              >
                <option value="daily">Daily Report</option>
                <option value="monthly">Monthly Summary</option>
              </select>
            </div>

            {/* Date Picker */}
            {reportType === 'daily' ? (
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Report Date</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                />
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Report Month</label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                />
              </div>
            )}
          </div>

          {/* Export Actions */}
          {records.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
              >
                <Download size={16} />
                <span>Excel</span>
              </button>
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-705 shadow-sm transition hover:bg-slate-50 active:scale-95"
              >
                <Download size={16} />
                <span>CSV</span>
              </button>
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-1.5 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-sky-500/25 transition hover:bg-sky-600 active:scale-95"
              >
                <FileText size={16} />
                <span>Export PDF</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm flex items-center gap-4">
          <div className="rounded-xl bg-sky-50 p-3 text-sky-500">
            <Table size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Entries</p>
            <p className="text-xl font-bold text-slate-800 mt-0.5">{summary.total}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm flex items-center gap-4">
          <div className="rounded-xl bg-emerald-50 p-3 text-emerald-500">
            <CheckCircle size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Present Today</p>
            <p className="text-xl font-bold text-slate-800 mt-0.5">{summary.present}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm flex items-center gap-4">
          <div className="rounded-xl bg-amber-50 p-3 text-amber-500">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Late Entries</p>
            <p className="text-xl font-bold text-slate-800 mt-0.5">{summary.late}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm flex items-center gap-4">
          <div className="rounded-xl bg-rose-50 p-3 text-rose-500">
            <XCircle size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Absent Entries</p>
            <p className="text-xl font-bold text-slate-800 mt-0.5">{summary.absent}</p>
          </div>
        </div>
      </div>

      {/* Preview Table */}
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-lg">
        <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 mb-4">Report Preview</h3>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-sky-500" />
          </div>
        ) : records.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 text-slate-400">
            <AlertCircle size={36} className="stroke-1" />
            <p className="mt-2 text-sm">No records to preview for selected period.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {reportType === 'monthly' && <th className="py-2.5 px-3">Date</th>}
                  <th className="py-2.5 px-3">Staff ID</th>
                  <th className="py-2.5 px-3">Name</th>
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3">Position</th>
                  <th className="py-2.5 px-3">Time In</th>
                  <th className="py-2.5 px-3">Time Out</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-sm text-slate-700">
                {records.map((r, index) => (
                  <tr key={index} className="hover:bg-slate-50 transition-all">
                    {reportType === 'monthly' && (
                      <td className="py-2.5 px-3 font-semibold text-slate-600">{r.date}</td>
                    )}
                    <td className="py-2.5 px-3 font-mono text-xs text-slate-500">
                      {r.formatted_id || r.staff_id}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-800">
                      {r.first_name} {r.last_name}
                    </td>
                    <td className="py-2.5 px-3 text-slate-550">{r.department_name}</td>
                    <td className="py-2.5 px-3 text-slate-550">{r.role_name}</td>
                    <td className="py-2.5 px-3 font-mono text-xs">{r.time_in || '--:--'}</td>
                    <td className="py-2.5 px-3 font-mono text-xs">{r.time_out || '--:--'}</td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
                        r.status === 'Present'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          : r.status === 'Late'
                          ? 'bg-amber-50 text-amber-700 border border-amber-100'
                          : 'bg-rose-50 text-rose-700 border border-rose-100'
                      }`}>
                        {r.status}
                      </span>
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
