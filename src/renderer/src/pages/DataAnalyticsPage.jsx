import React, { useState, useEffect, useCallback } from 'react'
import {
  TrendingUp,
  SlidersHorizontal,
  Calculator,
  Table,
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  AlertCircle,
  HelpCircle,
  Search,
  X
} from 'lucide-react'
import * as XLSX from 'xlsx'
import Pagination from '../components/ui/Pagination'
import Modal from '../components/ui/Modal'
import { DateRangePicker } from '../shared/DateRangePicker'
import { jsPDF } from 'jspdf'

function parseDateStr(str) {
  if (str === undefined || str === null || str === '') return null
  const s = String(str).trim()
  if (!s) return null

  // Check if it's an Excel date serial number
  const num = Number(s)
  if (!isNaN(num) && num > 30000 && num < 70000) {
    const excelEpoch = new Date(1899, 11, 30)
    const msPerDay = 24 * 60 * 60 * 1000
    return new Date(excelEpoch.getTime() + num * msPerDay)
  }

  // Try YYYY-MM-DD
  const ymdMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (ymdMatch) {
    return new Date(parseInt(ymdMatch[1]), parseInt(ymdMatch[2]) - 1, parseInt(ymdMatch[3]))
  }

  // Try M/D/YYYY
  const mdyMatch = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/)
  if (mdyMatch) {
    return new Date(parseInt(mdyMatch[3]), parseInt(mdyMatch[1]) - 1, parseInt(mdyMatch[2]))
  }

  const parsed = new Date(s)
  return isNaN(parsed.getTime()) ? null : parsed
}

function formatReportDate(start, end, minDate, maxDate) {
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
  const sDate = start || minDate
  const eDate = end || maxDate

  if (!sDate && !eDate) return 'All Records Report'

  const parsedStart = parseDateStr(sDate)
  const parsedEnd = parseDateStr(eDate)

  if (sDate === eDate && parsedStart) {
    return parsedStart.toLocaleDateString('en-US', options)
  }

  const startFormatted = parsedStart
    ? parsedStart.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Beginning'
  const endFormatted = parsedEnd
    ? parsedEnd.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'End'

  return `${startFormatted} - ${endFormatted}`
}

// CHANGED: added helper to convert raw Excel serial date/time numbers to human-readable format in the UI
function formatCellValue(colName, value) {
  return formatExportDateValue(colName, value)
}

function formatExportDateValue(colName, value) {
  if (value === undefined || value === null || value === '') return ''

  const isDateColumn = /date|time|inbound|operation|final/i.test(colName)
  if (!isDateColumn) return String(value)

  const num = Number(value)
  let date = null

  if (!isNaN(num) && num > 30000 && num < 70000) {
    const excelEpoch = new Date(1899, 11, 30)
    const msPerDay = 24 * 60 * 60 * 1000
    date = new Date(excelEpoch.getTime() + num * msPerDay)
  } else {
    const parsed = new Date(value)
    if (!isNaN(parsed.getTime())) {
      date = parsed
    }
  }

  if (!date) return String(value)

  const months = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'Jun.', 'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.']
  const monthStr = months[date.getMonth()]
  const dayStr = date.getDate()
  const yearStr = date.getFullYear()

  // Delivery Date must only show the date, do not include time
  const isDeliveryDate = /delivery\s*date/i.test(colName)
  const isTimeColumn = !isDeliveryDate && (/time|inbound|operation/i.test(colName) || (!isNaN(num) && num % 1 !== 0))

  if (isTimeColumn) {
    let hours = date.getHours()
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const ampm = hours >= 12 ? 'pm' : 'am'
    hours = hours % 12
    hours = hours ? hours : 12 // convert 0 to 12
    return `${monthStr} ${dayStr}, ${yearStr} ${hours}:${minutes} ${ampm}`
  } else {
    return `${monthStr} ${dayStr}, ${yearStr}`
  }
}

export default function DataAnalyticsPage() {
  const [datasets, setDatasets] = useState([])
  const [selectedDatasetId, setSelectedDatasetId] = useState('')
  const [selectedDataset, setSelectedDataset] = useState(null)

  const [columns, setColumns] = useState([])
  const [filterDefinitions, setFilterDefinitions] = useState([])

  // Dynamic filter inputs state
  // Key: filterDefinition.id, Value: { val1: '', val2: '' }
  const [filterValues, setFilterValues] = useState({})

  // Aggregation state
  const [aggConfig, setAggConfig] = useState({
    sum_column: '',
    avg_column: '',
    min_column: '',
    max_column: '',
    weight_column: '',
    weight_min: '',
    weight_max: ''
  })

  // Results State
  const [rows, setRows] = useState([])
  const [totalRows, setTotalRows] = useState(0)
  const [aggregates, setAggregates] = useState(null)

  const [isLoading, setIsLoading] = useState(true)
  const [isQuerying, setIsQuerying] = useState(false)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [limit, setLimit] = useState(50)

  // Export states
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)
  const [selectedRowDetails, setSelectedRowDetails] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const [metadata, setMetadata] = useState({ riders: [], minDate: '', maxDate: '' })

  // Debounce search query by 1.5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
      setCurrentPage(1)
    }, 1500)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const handleResetFilters = () => {
    const resetValues = {}
    filterDefinitions.forEach((def) => {
      if (def.filter_type === 'date_range') {
        resetValues[def.id] = { val1: metadata.minDate || '', val2: metadata.maxDate || '' }
      } else {
        resetValues[def.id] = { val1: '', val2: '' }
      }
    })
    setFilterValues(resetValues)
    setSearchQuery('')
    setDebouncedSearchQuery('')
    setCurrentPage(1)
  }

  useEffect(() => {
    const init = async () => {
      try {
        const dRes = await window.api.getDatasets()
        const fRes = await window.api.getActiveFilterDefinitions()
        setDatasets(dRes || [])
        setFilterDefinitions(fRes || [])

        if (dRes && dRes.length > 0) {
          setSelectedDatasetId(String(dRes[0].id))
        }
      } catch (err) {
        console.error('Failed to load datasets/filter definitions:', err)
      } finally {
        setIsLoading(false)
      }
    }
    init()
  }, [])

  // Load dataset metadata (min/max date, unique riders list) and auto-prefill filters
  useEffect(() => {
    const loadMetadata = async () => {
      if (!selectedDatasetId) {
        setMetadata({ riders: [], minDate: '', maxDate: '' })
        return
      }
      try {
        const res = await window.api.getDatasetMetadata(Number(selectedDatasetId))
        if (res && res.success) {
          setMetadata({
            riders: res.riders || [],
            minDate: res.minDate || '',
            maxDate: res.maxDate || ''
          })

          // Auto-prefill date range filter with dataset's min/max dates
          if (filterDefinitions.length > 0) {
            const dateDef = filterDefinitions.find((d) => d.filter_type === 'date_range')
            if (dateDef) {
              setFilterValues((prev) => ({
                ...prev,
                [dateDef.id]: { val1: res.minDate, val2: res.maxDate }
              }))
            }
          }
        }
      } catch (err) {
        console.error('Failed to load dataset metadata:', err)
      }
    }
    loadMetadata()
  }, [selectedDatasetId, filterDefinitions])

  useEffect(() => {
    if (selectedDatasetId) {
      const found = datasets.find((d) => String(d.id) === selectedDatasetId)
      setSelectedDataset(found || null)
      if (found) {
        try {
          const parsedCols = JSON.parse(found.columns_json)
          setColumns(parsedCols || [])

          // Auto-prefill aggregation columns with first numeric columns if possible
          setAggConfig({
            sum_column: parsedCols[0] || '',
            avg_column: parsedCols[0] || '',
            min_column: parsedCols[0] || '',
            max_column: parsedCols[0] || '',
            weight_column: parsedCols[0] || '',
            weight_min: '10',
            weight_max: '20'
          })
        } catch (e) {
          console.error('Failed to parse columns JSON:', e)
          setColumns([])
        }
      }
      setRows([])
      setTotalRows(0)
      setAggregates(null)
      setCurrentPage(1)
      setFilterValues({}) // CHANGED: clear previous filters when dataset changes
    } else {
      setSelectedDataset(null)
      setColumns([])
      setFilterValues({})
    }
  }, [selectedDatasetId, datasets])

  const handleFilterInputChange = (filterDefId, field, value) => {
    setFilterValues((prev) => ({
      ...prev,
      [filterDefId]: {
        ...prev[filterDefId],
        [field]: value
      }
    }))
    setCurrentPage(1)
  }

  const handleFilterRangeChange = (filterDefId, val1, val2) => {
    setFilterValues((prev) => ({
      ...prev,
      [filterDefId]: {
        val1,
        val2
      }
    }))
    setCurrentPage(1)
  }

  // Construct query filters payload
  const buildActiveFiltersPayload = useCallback(() => {
    const payload = []

    // Only map filters that correspond to active filter definitions
    filterDefinitions.forEach((def) => {
      const val = filterValues[def.id]
      if (!val) return

      const hasVal1 = val.val1 !== undefined && val.val1 !== null && val.val1 !== ''
      const hasVal2 = val.val2 !== undefined && val.val2 !== null && val.val2 !== ''

      if (hasVal1 || hasVal2) {
        payload.push({
          column_key: def.column_key,
          filter_type: def.filter_type,
          val1: val.val1 || '',
          val2: val.val2 || ''
        })
      }
    })

    if (debouncedSearchQuery.trim()) {
      payload.push({
        column_key: 'global_search',
        filter_type: 'global_search',
        val1: debouncedSearchQuery.trim(),
        val2: ''
      })
    }

    return payload
  }, [filterDefinitions, filterValues, debouncedSearchQuery])

  const runQuery = useCallback(
    async (page = 1) => {
      if (!selectedDatasetId) return
      setIsQuerying(true)
      try {
        const activeFilters = buildActiveFiltersPayload()
        const offset = (page - 1) * limit

        // Fetch row data
        const rowsRes = await window.api.queryDatasetRows({
          datasetId: Number(selectedDatasetId),
          activeFilters,
          limit,
          offset
        })

        // Fetch aggregates
        const aggRes = await window.api.aggregateDataset({
          datasetId: Number(selectedDatasetId),
          activeFilters,
          aggregateConfig: aggConfig
        })

        if (rowsRes.success) {
          setRows(rowsRes.rows || [])
          setTotalRows(rowsRes.total || 0)
        } else {
          alert('Query failed: ' + rowsRes.message)
        }

        if (aggRes.success) {
          setAggregates(aggRes.summary || null)
        }
      } catch (err) {
        console.error(err)
        alert('Error running analytics query.')
      } finally {
        setIsQuerying(false)
      }
    },
    [selectedDatasetId, buildActiveFiltersPayload, aggConfig, limit]
  )

  // Automatically update results when selectedDatasetId, filterValues, debouncedSearchQuery, aggConfig, or currentPage changes
  useEffect(() => {
    if (selectedDatasetId) {
      runQuery(currentPage)
    }
  }, [selectedDatasetId, filterValues, debouncedSearchQuery, aggConfig, currentPage, runQuery])

  const handleApplyFilters = (e) => {
    e.preventDefault()
  }

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage)
  }

  const handleExportFiltered = () => {
    if (rows.length === 0 || !selectedDataset) return
    setIsExportModalOpen(true)
  }

  const triggerExport = async (format) => {
    if (rows.length === 0 || !selectedDataset) return

    try {
      let extensions = ['xlsx']
      let extensionName = 'Excel Workbook'
      let defaultFilename = `clean_report_${selectedDataset.file_name.replace(/\.[^/.]+$/, '')}`

      if (format === 'clean_pdf') {
        extensions = ['pdf']
        extensionName = 'PDF Document'
      } else if (format === 'raw_xlsx') {
        defaultFilename = `raw_dump_${selectedDataset.file_name.replace(/\.[^/.]+$/, '')}`
      }

      const fileDialogRes = await window.api.saveFileDialog({
        title: 'Export Data',
        defaultPath: defaultFilename,
        filters: [{ name: extensionName, extensions }]
      })

      const targetPath = typeof fileDialogRes === 'object' ? fileDialogRes.filePath : fileDialogRes
      const isCanceled = typeof fileDialogRes === 'object' ? fileDialogRes.canceled : !targetPath

      if (isCanceled || !targetPath) return

      // Fetch all matching rows (no pagination limit)
      const activeFilters = buildActiveFiltersPayload()
      const allRowsRes = await window.api.queryDatasetRows({
        datasetId: Number(selectedDatasetId),
        activeFilters,
        limit: 1000000,
        offset: 0
      })

      if (!allRowsRes.success || !allRowsRes.rows) {
        alert('Failed to fetch full row data for export.')
        return
      }

      const allRows = allRowsRes.rows.map((r) => r.data)

      if (format === 'raw_xlsx') {
        const formattedRows = allRows.map((r) => {
          const formatted = {}
          Object.keys(r).forEach((k) => {
            formatted[k] = formatExportDateValue(k, r[k])
          })
          return formatted
        })
        const ws = XLSX.utils.json_to_sheet(formattedRows)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Raw Data')
        XLSX.writeFile(wb, targetPath)
        alert(`Successfully exported raw data to:\n${targetPath}`)
        return
      }

      // Grouping logic for clean reports
      const deliveredRows = allRows.filter(
        (r) => String(r['Parcel Status']).trim().toLowerCase() === 'delivered'
      )
      const detainedRows = allRows.filter(
        (r) => String(r['Parcel Status']).trim().toLowerCase() === 'detained'
      )

      const deliveredByRider = {}
      deliveredRows.forEach((row) => {
        const rider = String(row['Final Operation Person'] || '').trim() || 'Unassigned'
        if (!deliveredByRider[rider]) {
          deliveredByRider[rider] = []
        }
        deliveredByRider[rider].push(row)
      })

      const riders = Object.keys(deliveredByRider).sort()

      const dateDef = filterDefinitions.find((d) => d.filter_type === 'date_range')
      const dateVal = dateDef ? filterValues[dateDef.id] : null
      const dateFrom = dateVal ? dateVal.val1 : ''
      const dateTo = dateVal ? dateVal.val2 : ''
      const reportDateStr = formatReportDate(dateFrom, dateTo, metadata.minDate, metadata.maxDate)

      const headers = [
        'Tracking Number',
        'Parcel Status',
        'Inbound Time',
        'First to Deliver Category',
        'Client Category',
        'Chargeable Weight',
        'Parcel Weight Range',
        'Actual weight',
        'Actual length',
        'Actual width',
        'Actual high',
        'Consignee Address',
        'COD Amount',
        'Payment method',
        'Problematic Mark',
        'Need to Return or not',
        'Suspected Lost or not',
        'Final Operation Time',
        'Final Operation Person',
        'Delivery Date'
      ]

      if (format === 'clean_xlsx') {
        const aoa = []

        // Title Row
        aoa.push([reportDateStr])
        aoa.push([])

        // Summary Cards Section
        aoa.push(['PARCELS ARRIVED TODAY', 'DELIVERED', 'DETAINED', 'TOTAL REMIT'])
        aoa.push([
          aggregates.new_parcels_arrived || 0,
          aggregates.delivered_count || 0,
          aggregates.detained_count || 0,
          Number(aggregates.total_remittance || 0).toFixed(2)
        ])
        aoa.push([])
        aoa.push([])

        // Table Headers
        aoa.push(headers)

        // Delivered Groups
        riders.forEach((rider) => {
          const riderRows = deliveredByRider[rider]
          riderRows.forEach((r) => {
            aoa.push(headers.map((h) => formatExportDateValue(h, r[h])))
          })

          // Subtotal Row
          const subtotalRow = Array(headers.length).fill('')
          subtotalRow[0] = 'Total'
          subtotalRow[1] = riderRows.length
          const codSum = riderRows.reduce(
            (sum, r) => sum + (parseFloat(r['COD Amount']) || 0),
            0
          )
          subtotalRow[12] = codSum.toFixed(2)
          aoa.push(subtotalRow)
        })

        // Detained Group
        if (detainedRows.length > 0) {
          detainedRows.forEach((r) => {
            aoa.push(headers.map((h) => formatExportDateValue(h, r[h])))
          })

          // Detained Subtotal Row
          const subtotalRow = Array(headers.length).fill('')
          subtotalRow[0] = 'Total'
          subtotalRow[1] = detainedRows.length
          aoa.push(subtotalRow)
        }

        const ws = XLSX.utils.aoa_to_sheet(aoa)
        ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 3, 12) }))

        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Clean Report')
        XLSX.writeFile(wb, targetPath)

        alert(`Successfully exported Clean Excel Report to:\n${targetPath}`)
      } else if (format === 'clean_pdf') {
        const doc = new jsPDF({ orientation: 'landscape', format: 'a4' })

        const YLimit = 195

        // Drawing title
        doc.setFont('Helvetica', 'bold')
        doc.setFontSize(14)
        doc.setTextColor(30, 41, 59)
        doc.text(reportDateStr, 148.5, 18, { align: 'center' })

        // Drawing summary cards
        const drawCard = (x, title, val, bgColor, borderColor, textCol, valCol) => {
          doc.setFillColor(bgColor[0], bgColor[1], bgColor[2])
          doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2])
          doc.setLineWidth(0.3)
          doc.roundedRect(x, 24, 65.5, 18, 2, 2, 'FD')

          doc.setFont('Helvetica', 'bold')
          doc.setFontSize(7)
          doc.setTextColor(textCol[0], textCol[1], textCol[2])
          doc.text(title, x + 32.75, 30, { align: 'center' })

          doc.setFont('Helvetica', 'bold')
          doc.setFontSize(14)
          doc.setTextColor(valCol[0], valCol[1], valCol[2])
          doc.text(String(val), x + 32.75, 38, { align: 'center' })
        }

        drawCard(
          10,
          'PARCELS ARRIVED TODAY',
          aggregates.new_parcels_arrived || 0,
          [253, 246, 226],
          [245, 214, 160],
          [146, 64, 14],
          [120, 53, 4]
        )
        drawCard(
          80.5,
          'DELIVERED',
          aggregates.delivered_count || 0,
          [235, 247, 238],
          [193, 231, 196],
          [22, 101, 52],
          [20, 83, 45]
        )
        drawCard(
          151,
          'DETAINED',
          aggregates.detained_count || 0,
          [253, 242, 242],
          [245, 198, 198],
          [153, 27, 27],
          [153, 27, 27]
        )
        drawCard(
          221.5,
          'TOTAL REMIT',
          Number(aggregates.total_remittance || 0).toFixed(2),
          [254, 240, 138],
          [250, 204, 21],
          [133, 77, 14],
          [113, 63, 4]
        )

        // Table setup
        const colWidths = [
          23, 14, 20, 10, 10, 10, 16, 13, 10, 10, 10, 28, 14, 12, 10, 10, 10, 20, 21, 16
        ]

        const drawTableHeaders = (yPos) => {
          doc.setFont('Helvetica', 'bold')
          doc.setFontSize(5.2)
          doc.setTextColor(30, 41, 59)
          let currentX = 10
          headers.forEach((h, idx) => {
            const w = colWidths[idx]
            doc.setFillColor(224, 242, 254) // Highlight header in light sky-blue
            doc.setDrawColor(186, 230, 253) // Sky-blue borders
            doc.rect(currentX, yPos, w, 5, 'FD')
            // Truncate header text to fit
            const maxChars = Math.floor(w * 1.5)
            const cleanH = String(h).substring(0, maxChars)
            doc.text(cleanH, currentX + 0.8, yPos + 3.5)
            currentX += w
          })
        }

        const truncateText = (text, width) => {
          const s = String(text)
          const maxChars = Math.floor(width * 2.2)
          if (s.length > maxChars) {
            return s.substring(0, Math.max(1, maxChars - 2)) + '..'
          }
          return s
        }

        let y = 48
        drawTableHeaders(y)
        y += 5

        doc.setFont('Helvetica', 'normal')
        doc.setFontSize(5)
        doc.setTextColor(51, 65, 85)

        const drawRow = (r, isSubtotal = false, subtotalCount = 0, subtotalCODSum = 0) => {
          // Page check
          if (y + 5.5 > YLimit) {
            doc.addPage()
            y = 15
            drawTableHeaders(y)
            y += 5
          }

          let currentX = 10
          if (isSubtotal) {
            colWidths.forEach((w, idx) => {
              doc.setFillColor(254, 240, 138) // Explicitly set yellow fill color inside the loop
              doc.setDrawColor(203, 213, 225)
              doc.rect(currentX, y, w, 5.5, 'FD')

              doc.setFont('Helvetica', 'bold')
              doc.setFontSize(5.2)
              doc.setTextColor(30, 41, 59)

              if (idx === 0) {
                doc.text('Total', currentX + 0.8, y + 3.8)
              } else if (idx === 1) {
                doc.text(String(subtotalCount), currentX + 0.8, y + 3.8)
              } else if (idx === 12 && subtotalCODSum > 0) {
                doc.text(subtotalCODSum.toFixed(2), currentX + 0.8, y + 3.8)
              }
              currentX += w
            })
          } else {
            // Standard data row
            colWidths.forEach((w, idx) => {
              doc.setDrawColor(226, 232, 240)
              doc.rect(currentX, y, w, 5.5, 'D')

              doc.setFont('Helvetica', 'normal')
              doc.setFontSize(5)
              doc.setTextColor(51, 65, 85)

              const cellVal = formatExportDateValue(headers[idx], r[headers[idx]])
              const cleanCellVal = truncateText(cellVal, w)
              doc.text(cleanCellVal, currentX + 0.8, y + 3.8)
              currentX += w
            })
          }
          y += 5.5
        }

        // Draw delivered riders
        riders.forEach((rider) => {
          const riderRows = deliveredByRider[rider]
          riderRows.forEach((r) => {
            drawRow(r)
          })
          const codSum = riderRows.reduce(
            (sum, r) => sum + (parseFloat(r['COD Amount']) || 0),
            0
          )
          drawRow(null, true, riderRows.length, codSum)
        })

        // Draw detained rows
        if (detainedRows.length > 0) {
          detainedRows.forEach((r) => {
            drawRow(r)
          })
          drawRow(null, true, detainedRows.length, 0)
        }

        // Save PDF using base64 IPC
        const pdfDataUri = doc.output('datauristring')
        const pdfBase64 = pdfDataUri.split(',')[1]

        const saveRes = await window.api.writeFileBase64(targetPath, pdfBase64)
        if (saveRes.success) {
          alert(`Successfully exported Clean PDF Report to:\n${targetPath}`)
        } else {
          alert('Failed to save PDF: ' + saveRes.message)
        }
      }
    } catch (err) {
      console.error(err)
      alert('Export failed.')
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-sky-500" />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden space-y-4 pb-2 pr-2">
      {/* Dataset Selection */}
      <div className="shrink-0 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-3">
            <label className="text-xs font-bold text-slate-705 dark:text-slate-350 shrink-0">
              Select Active Dataset:
            </label>
            <select
              value={selectedDatasetId}
              onChange={(e) => {
                setSelectedDatasetId(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full sm:max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 text-slate-700 dark:text-slate-200 font-medium"
            >
              <option value="">-- Choose Dataset --</option>
              {datasets.map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {d.file_name} ({d.row_count} rows, imported{' '}
                  {new Date(d.imported_at).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>

          {/* Global Search Bar */}
          <div className="relative w-full sm:w-80">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400 dark:text-slate-550" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
              }}
              placeholder="Search tracking, rider, status, address..."
              className="w-full pl-9 pr-14 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-700 dark:text-slate-200 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
            />
            {/* Loading / Typing indicator */}
            <div className="absolute right-3 top-2.5 flex items-center gap-1">
              {searchQuery !== debouncedSearchQuery ? (
                <span className="text-[10px] text-slate-400 dark:text-slate-500 animate-pulse">Typing...</span>
              ) : isQuerying ? (
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-200 border-t-sky-500" />
              ) : searchQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('')
                    setDebouncedSearchQuery('')
                    setCurrentPage(1)
                  }}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
                >
                  <X size={14} />
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {!selectedDatasetId ? (
        <div className="flex flex-col items-center justify-center h-[40vh] border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 text-slate-400 p-6">
          <TrendingUp size={48} className="stroke-1 text-slate-400" />
          <h3 className="mt-4 text-base font-bold text-slate-705">No Dataset Loaded</h3>
          <p className="text-sm text-slate-400 mt-1">
            Please import a CSV or Excel workbook on the Data Import page first, then choose it
            above.
          </p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 grid grid-cols-1 gap-6 lg:grid-cols-12 overflow-hidden pb-1 pr-1">
          {/* Left Panel: Query Config and Calculation Rules */}
          <div className="lg:col-span-4 flex flex-col h-full max-h-full">
            <form
              onSubmit={handleApplyFilters}
              className="flex-1 overflow-y-auto space-y-4 pb-4 pr-3 pt-1 pl-1"
            >
              {/* Dynamic Filter Inputs */}
              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-md space-y-3">
                <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                  <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <SlidersHorizontal size={14} className="text-sky-500" />
                    <span>Dynamic Query Filters</span>
                  </h3>
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="text-[10px] font-bold text-sky-500 hover:text-sky-700 transition"
                  >
                    Reset Filters
                  </button>
                </div>

                {filterDefinitions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-6 text-slate-400 border border-dashed border-slate-100 rounded-xl">
                    <AlertCircle size={24} className="stroke-1 text-slate-350" />
                    <p className="mt-1 text-[10px] text-center">
                      No active dynamic filters configured in Settings.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filterDefinitions.map((def) => {
                      const val = filterValues[def.id] || { val1: '', val2: '' }

                      return (
                        <div key={def.id} className="space-y-1 flex flex-col items-start">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                            {def.filter_name}
                          </label>

                          {/* Render Inputs dynamically */}
                          {def.filter_type === 'date_range' && (
                            <div className="w-full">
                              <DateRangePicker
                                dateFrom={val.val1 || ''}
                                dateTo={val.val2 || ''}
                                className="w-full flex"
                                onChange={({ dateFrom: from, dateTo: to }) => {
                                  handleFilterRangeChange(def.id, from, to)
                                }}
                              />
                            </div>
                          )}

                          {def.filter_type === 'number_range' && (
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="number"
                                step="any"
                                value={val.val1 || ''}
                                onChange={(e) =>
                                  handleFilterInputChange(def.id, 'val1', e.target.value)
                                }
                                className="rounded-xl border border-slate-200 bg-white p-1.5 text-xs outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20"
                                placeholder="Min"
                              />
                              <input
                                type="number"
                                step="any"
                                value={val.val2 || ''}
                                onChange={(e) =>
                                  handleFilterInputChange(def.id, 'val2', e.target.value)
                                }
                                className="rounded-xl border border-slate-200 bg-white p-1.5 text-xs outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20"
                                placeholder="Max"
                              />
                            </div>
                          )}

                          {def.filter_type === 'dropdown' && (
                            <select
                              value={val.val1 || ''}
                              onChange={(e) =>
                                handleFilterInputChange(def.id, 'val1', e.target.value)
                              }
                              className="w-full rounded-xl border border-slate-200 bg-white p-1.5 text-xs outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20"
                            >
                              <option value="">-- Choose Option --</option>
                              {(() => {
                                if (def.column_key === 'Final Operation Person') {
                                  return metadata.riders.map((r, idx) => (
                                    <option key={idx} value={r}>
                                      {r}
                                    </option>
                                  ))
                                }
                                if (def.column_key === 'Actual weight') {
                                  return ['0-9 kgs', '10-19 kgs', '20+ kgs'].map((o, idx) => (
                                    <option key={idx} value={o}>
                                      {o}
                                    </option>
                                  ))
                                }
                                try {
                                  const opts = JSON.parse(def.options_json)
                                  return (opts || []).map((o, idx) => (
                                    <option key={idx} value={o}>
                                      {o}
                                    </option>
                                  ))
                                } catch (err) {
                                  return null
                                }
                              })()}
                            </select>
                          )}

                          {(def.filter_type === 'exact_match' ||
                            def.filter_type === 'contains') && (
                              <input
                                type="text"
                                value={val.val1 || ''}
                                onChange={(e) =>
                                  handleFilterInputChange(def.id, 'val1', e.target.value)
                                }
                                placeholder={
                                  def.filter_type === 'contains' ? 'Contains...' : 'Exact match...'
                                }
                                className="w-full rounded-xl border border-slate-200 bg-white p-1.5 text-xs outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20"
                              />
                            )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Aggregation Summary Cards (2 columns per row) */}
              {aggregates && (
                <div className="grid grid-cols-2 gap-3 shrink-0">
                  <div className="rounded-xl border border-amber-250 bg-amber-50/30 dark:border-amber-500/20 dark:bg-amber-950/15 p-3 shadow-sm flex flex-col items-center justify-center text-center">
                    <p className="text-[10px] font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider">
                      PARCELS ARRIVED TODAY
                    </p>
                    <p className="mt-1 text-2xl font-black text-amber-900 dark:text-amber-200">
                      {aggregates.new_parcels_arrived !== undefined ? aggregates.new_parcels_arrived : 0}
                    </p>
                  </div>
                  <div className="rounded-xl border border-emerald-250 bg-emerald-50/30 dark:border-emerald-500/20 dark:bg-emerald-950/15 p-3 shadow-sm flex flex-col items-center justify-center text-center">
                    <p className="text-[10px] font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">
                      DELIVERED
                    </p>
                    <p className="mt-1 text-2xl font-black text-emerald-950 dark:text-emerald-200">
                      {aggregates.delivered_count !== undefined ? aggregates.delivered_count : 0}
                    </p>
                  </div>
                  <div className="rounded-xl border border-red-250 bg-red-50/30 dark:border-red-500/20 dark:bg-red-950/15 p-3 shadow-sm flex flex-col items-center justify-center text-center">
                    <p className="text-[10px] font-bold text-red-800 dark:text-red-400 uppercase tracking-wider">
                      DETAINED
                    </p>
                    <p className="mt-1 text-2xl font-black text-red-955 dark:text-red-200">
                      {aggregates.detained_count !== undefined ? aggregates.detained_count : 0}
                    </p>
                  </div>
                  <div className="rounded-xl border border-yellow-350 bg-yellow-100 dark:border-yellow-500/20 dark:bg-yellow-950/15 p-3 shadow-sm flex flex-col items-center justify-center text-center">
                    <p className="text-[10px] font-bold text-yellow-800 dark:text-yellow-400 uppercase tracking-wider">
                      TOTAL REMIT
                    </p>
                    <p className="mt-1 text-2xl font-black text-yellow-955 dark:text-yellow-200 font-mono">
                      {aggregates.total_remittance !== undefined
                        ? `₱${Number(aggregates.total_remittance).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}`
                        : '₱0.00'}
                    </p>
                  </div>
                </div>
              )}

              {/* Weight Distribution Card */}
              {aggregates && (
                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-md space-y-3">
                  <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-50 pb-2">
                    <SlidersHorizontal size={14} className="text-sky-500" />
                    <span>Weight Category Distribution</span>
                  </h3>
                  <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                    <div className="bg-slate-50/50 p-2 rounded-lg border border-slate-100 flex flex-col justify-between h-14">
                      <p className="text-slate-450 font-bold uppercase tracking-wider">0-9 kg</p>
                      <p className="text-slate-700 text-lg font-black mt-0.5">
                        {aggregates.weight_0_9 !== undefined ? aggregates.weight_0_9 : 0}
                      </p>
                    </div>
                    <div className="bg-slate-50/50 p-2 rounded-lg border border-slate-100 flex flex-col justify-between h-14">
                      <p className="text-slate-450 font-bold uppercase tracking-wider">10-19 kg</p>
                      <p className="text-slate-700 text-lg font-black mt-0.5">
                        {aggregates.weight_10_19 !== undefined ? aggregates.weight_10_19 : 0}
                      </p>
                    </div>
                    <div className="bg-slate-50/50 p-2 rounded-lg border border-slate-100 flex flex-col justify-between h-14">
                      <p className="text-slate-450 font-bold uppercase tracking-wider">20+ kg</p>
                      <p className="text-slate-700 text-lg font-black mt-0.5">
                        {aggregates.weight_20_plus !== undefined ? aggregates.weight_20_plus : 0}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </form>
          </div>

          {/* Right Panel: Data Table */}
          <div className="lg:col-span-8 flex flex-col h-full overflow-hidden space-y-4 pb-3 pr-3 pt-1 pl-1">
            {/* Results Table */}
            <div className="flex-1 min-h-0 rounded-2xl border border-slate-100 bg-white p-5 shadow-lg flex flex-col space-y-4 overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-50 pb-2 shrink-0">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-800">Results Table</h3>
                    {isQuerying && <RefreshCw size={12} className="animate-spin text-sky-500" />}
                  </div>
                  <p className="text-[10px] text-slate-450 mt-0.5">Matched records: {totalRows}</p>
                </div>

                {rows.length > 0 && (
                  <button
                    onClick={handleExportFiltered}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
                  >
                    <Download size={14} />
                    <span>Export Filtered</span>
                  </button>
                )}
              </div>

              {rows.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 text-slate-400 p-6">
                  <Table size={36} className="stroke-1 animate-pulse" />
                  <h4 className="mt-3 text-sm font-semibold text-slate-700">No Data Found</h4>
                  <p className="text-xs text-slate-400 text-center max-w-xs mt-0.5">
                    No records match the active filters, or the dataset is empty. Use the filters on
                    the left to query and calculate statistics.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto overflow-x-auto pb-1 pr-1">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px] sticky top-0 bg-white z-10 shadow-sm">
                          <th className="py-2.5 px-3 bg-white">#</th>
                          {columns.map((col) => (
                            <th key={col} className="py-2.5 px-3 bg-white">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-slate-650">
                        {rows.map((row) => (
                          <tr
                            key={row.id}
                            onClick={() => setSelectedRowDetails(row)}
                            className="hover:bg-slate-50/70 transition-all font-mono cursor-pointer active:bg-slate-100/50"
                          >
                            <td className="py-2 px-3 text-slate-400 font-sans">
                              {row.row_index + 1}
                            </td>
                            {columns.map((col) => (
                              <td
                                key={col}
                                className="py-2 px-3 truncate max-w-[150px]"
                                title={formatCellValue(col, row.data[col])}
                              >
                                {formatCellValue(col, row.data[col])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  <Pagination
                    currentPage={currentPage}
                    totalItems={totalRows}
                    itemsPerPage={limit}
                    onChangePage={setCurrentPage}
                    onChangeItemsPerPage={setLimit}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Export Format Selection Modal */}
      <Modal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        title="Select Export Format"
      >
        <div className="space-y-4 p-2">
          <p className="text-xs text-slate-500">
            Choose how you want to export the filtered dataset:
          </p>

          <div className="grid grid-cols-1 gap-3">
            <button
              onClick={() => {
                setIsExportModalOpen(false)
                triggerExport('clean_xlsx')
              }}
              className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-sky-500 transition text-left"
            >
              <div>
                <p className="text-xs font-bold text-slate-800">Clean Excel Report (.xlsx)</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Formatted spreadsheet with summary cards and rows grouped by rider/status.
                </p>
              </div>
              <Download size={16} className="text-slate-400" />
            </button>

            <button
              onClick={() => {
                setIsExportModalOpen(false)
                triggerExport('clean_pdf')
              }}
              className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-sky-500 transition text-left"
            >
              <div>
                <p className="text-xs font-bold text-slate-800">Clean PDF Report (.pdf)</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  High-quality landscape printable document based on the J&T Franchisee template.
                </p>
              </div>
              <Download size={16} className="text-slate-400" />
            </button>

            <button
              onClick={() => {
                setIsExportModalOpen(false)
                triggerExport('raw_xlsx')
              }}
              className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-sky-500 transition text-left"
            >
              <div>
                <p className="text-xs font-bold text-slate-800">Raw Data Dump (.xlsx)</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Standard row-by-row table dump of all columns.
                </p>
              </div>
              <Download size={16} className="text-slate-400" />
            </button>
          </div>
        </div>
      </Modal>

      {/* Parcel Details Modal */}
      <Modal
        isOpen={!!selectedRowDetails}
        onClose={() => setSelectedRowDetails(null)}
        title="Parcel Details"
        size="2xl"
      >
        {selectedRowDetails && (
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            {/* Top tracking header */}
            <div className="bg-sky-50/50 dark:bg-sky-950/20 rounded-xl p-3.5 border border-sky-100 dark:border-sky-900/30 flex justify-between items-center">
              <div>
                <p className="text-[10px] text-sky-500 dark:text-sky-400 font-bold uppercase tracking-wider">TRACKING NUMBER</p>
                <p className="text-base font-black text-slate-800 dark:text-slate-100 mt-0.5 font-mono">{selectedRowDetails.data['Tracking Number']}</p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-black ${
                String(selectedRowDetails.data['Parcel Status']).trim().toLowerCase() === 'delivered'
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30'
                  : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900/30'
              }`}>
                {selectedRowDetails.data['Parcel Status']}
              </span>
            </div>

            {/* Main grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Delivery info block */}
              <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/20 p-3 space-y-2">
                <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-1">
                  Delivery & Status Info
                </h4>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-slate-450 dark:text-slate-400 font-bold shrink-0">Rider / Courier</span>
                    <span className="text-slate-700 dark:text-slate-200 font-semibold text-right">{selectedRowDetails.data['Final Operation Person'] || 'Unassigned'}</span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-slate-450 dark:text-slate-400 font-bold shrink-0">Delivery Date</span>
                    <span className="text-slate-700 dark:text-slate-200 font-semibold text-right">{formatCellValue('Delivery Date', selectedRowDetails.data['Delivery Date'])}</span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-slate-450 dark:text-slate-400 font-bold shrink-0">Final Op Time</span>
                    <span className="text-slate-700 dark:text-slate-200 font-semibold text-right">{formatCellValue('Final Operation Time', selectedRowDetails.data['Final Operation Time'])}</span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-slate-450 dark:text-slate-400 font-bold shrink-0">Inbound Time</span>
                    <span className="text-slate-700 dark:text-slate-200 font-semibold text-right">{formatCellValue('Inbound Time', selectedRowDetails.data['Inbound Time'])}</span>
                  </div>
                </div>
              </div>

              {/* Weight & Size Block */}
              <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/20 p-3 space-y-2">
                <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-1">
                  Dimensions & Weights
                </h4>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-slate-450 dark:text-slate-400 font-bold shrink-0">Actual Weight</span>
                    <span className="text-slate-700 dark:text-slate-200 font-semibold text-right">{selectedRowDetails.data['Actual weight'] || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-slate-450 dark:text-slate-400 font-bold shrink-0">Chargeable Weight</span>
                    <span className="text-slate-700 dark:text-slate-200 font-semibold text-right">{selectedRowDetails.data['Chargeable Weight'] ? `${selectedRowDetails.data['Chargeable Weight']} kg` : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-slate-450 dark:text-slate-400 font-bold shrink-0">Weight Range</span>
                    <span className="text-slate-700 dark:text-slate-200 font-semibold text-right">{selectedRowDetails.data['Parcel Weight Range'] || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-slate-450 dark:text-slate-400 font-bold shrink-0">Size (L x W x H)</span>
                    <span className="text-slate-700 dark:text-slate-200 font-semibold text-right">
                      {selectedRowDetails.data['Actual length'] && selectedRowDetails.data['Actual width']
                        ? `${selectedRowDetails.data['Actual length']} x ${selectedRowDetails.data['Actual width']} x ${selectedRowDetails.data['Actual high'] || '0'}`
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* COD & Payments Block */}
              <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/20 p-3 space-y-2">
                <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-1">
                  Remittance & COD
                </h4>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-slate-450 dark:text-slate-400 font-bold shrink-0">COD Amount</span>
                    <span className="text-amber-850 dark:text-amber-400 font-extrabold font-mono text-right">
                      {selectedRowDetails.data['COD Amount'] !== undefined
                        ? `₱${Number(selectedRowDetails.data['COD Amount']).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}`
                        : '₱0.00'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-slate-450 dark:text-slate-400 font-bold shrink-0">Payment Method</span>
                    <span className="text-slate-700 dark:text-slate-200 font-semibold text-right">{selectedRowDetails.data['Payment method'] || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-slate-450 dark:text-slate-400 font-bold shrink-0">Client Category</span>
                    <span className="text-slate-700 dark:text-slate-200 font-semibold text-right">{selectedRowDetails.data['Client Category'] || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Status Marks Block */}
              <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/20 p-3 space-y-2">
                <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-1">
                  Exception & Status Marks
                </h4>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-slate-450 dark:text-slate-400 font-bold shrink-0">Problematic Mark</span>
                    <span className="text-slate-700 dark:text-slate-200 font-semibold text-right">{selectedRowDetails.data['Problematic Mark'] || 'None'}</span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-slate-450 dark:text-slate-400 font-bold shrink-0">Need to Return</span>
                    <span className="text-slate-700 dark:text-slate-200 font-semibold text-right">{selectedRowDetails.data['Need to Return or not'] || 'No'}</span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-slate-450 dark:text-slate-400 font-bold shrink-0">Suspected Lost</span>
                    <span className="text-slate-700 dark:text-slate-200 font-semibold text-right">{selectedRowDetails.data['Suspected Lost or not'] || 'No'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Consignee Address */}
            <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/20 p-3 space-y-1.5">
              <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-1">
                Consignee Address
              </h4>
              <p className="text-xs text-slate-700 dark:text-slate-200 font-semibold leading-relaxed">
                {selectedRowDetails.data['Consignee Address'] || 'N/A'}
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
