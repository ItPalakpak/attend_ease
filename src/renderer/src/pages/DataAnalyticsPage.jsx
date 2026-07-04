import React, { useState, useEffect, useCallback } from 'react'
import { TrendingUp, SlidersHorizontal, Calculator, Table, ChevronLeft, ChevronRight, Download, RefreshCw, AlertCircle, HelpCircle } from 'lucide-react'
import * as XLSX from 'xlsx'

// CHANGED: added helper to convert raw Excel serial date/time numbers to human-readable format in the UI
function formatCellValue(colName, value) {
  if (value === undefined || value === null || value === '') return ''
  
  // Heuristic check: column name suggests a date/time and the value falls into Excel's date serial range
  const isDateColumn = /date|time|inbound|operation|final/i.test(colName)
  const num = Number(value)
  
  if (isDateColumn && !isNaN(num) && num > 30000 && num < 70000) {
    const excelEpoch = new Date(1899, 11, 30)
    const msPerDay = 24 * 60 * 60 * 1000
    const date = new Date(excelEpoch.getTime() + num * msPerDay)
    
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    
    if (num % 1 !== 0) {
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      const seconds = String(date.getSeconds()).padStart(2, '0')
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
    }
    return `${year}-${month}-${day}`
  }
  
  return String(value)
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
  const limit = 50

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

    return payload
  }, [filterDefinitions, filterValues])

  const runQuery = useCallback(async (page = 1) => {
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
  }, [selectedDatasetId, buildActiveFiltersPayload, aggConfig, limit])

  // Automatically update results when selectedDatasetId, filterValues, aggConfig, or currentPage changes
  useEffect(() => {
    if (selectedDatasetId) {
      runQuery(currentPage)
    }
  }, [selectedDatasetId, filterValues, aggConfig, currentPage, runQuery])

  const handleApplyFilters = (e) => {
    e.preventDefault()
  }

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage)
  }

  const handleExportFiltered = async () => {
    if (rows.length === 0 || !selectedDataset) return

    try {
      const defaultFilename = `filtered_${selectedDataset.file_name}`
      const fileDialogRes = await window.api.saveFileDialog({
        title: 'Export Filtered Analytics Data',
        defaultPath: defaultFilename,
        filters: [
          { name: 'Excel Workbook', extensions: ['xlsx'] },
          { name: 'CSV File', extensions: ['csv'] }
        ]
      })

      const targetPath = typeof fileDialogRes === 'object' ? fileDialogRes.filePath : fileDialogRes
      const isCanceled = typeof fileDialogRes === 'object' ? fileDialogRes.canceled : !targetPath

      if (isCanceled || !targetPath) return

      // Build data dump by querying ALL matching rows (no limit)
      const activeFilters = buildActiveFiltersPayload()
      const allRowsRes = await window.api.queryDatasetRows({
        datasetId: Number(selectedDatasetId),
        activeFilters,
        limit: 1000000, // Very large limit to get all
        offset: 0
      })

      if (!allRowsRes.success || !allRowsRes.rows) {
        alert('Failed to fetch full row data for export.')
        return
      }

      const flatData = allRowsRes.rows.map((r) => r.data)
      const ws = XLSX.utils.json_to_sheet(flatData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Filtered Data')

      XLSX.writeFile(wb, targetPath)
      alert(`Successfully exported data to:\n${targetPath}`)
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
    <div className="h-[calc(100vh-175px)] flex flex-col overflow-hidden space-y-4 pb-2 pr-2">
      {/* Dataset Selection */}
      <div className="shrink-0 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="text-xs font-bold text-slate-700 shrink-0">Select Active Dataset:</label>
          <select
            value={selectedDatasetId}
            onChange={(e) => setSelectedDatasetId(e.target.value)}
            className="w-full flex-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
          >
            <option value="">-- Choose Dataset --</option>
            {datasets.map((d) => (
              <option key={d.id} value={String(d.id)}>
                {d.file_name} ({d.row_count} rows, imported {new Date(d.imported_at).toLocaleDateString()})
              </option>
            ))}
          </select>
        </div>
      </div>

      {!selectedDatasetId ? (
        <div className="flex flex-col items-center justify-center h-[40vh] border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 text-slate-400 p-6">
          <TrendingUp size={48} className="stroke-1 text-slate-400" />
          <h3 className="mt-4 text-base font-bold text-slate-705">No Dataset Loaded</h3>
          <p className="text-sm text-slate-400 mt-1">Please import a CSV or Excel workbook on the Data Import page first, then choose it above.</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 grid grid-cols-1 gap-6 lg:grid-cols-12 overflow-hidden pb-1 pr-1">
          
          {/* Left Panel: Query Config and Calculation Rules */}
          <div className="lg:col-span-4 flex flex-col h-full max-h-full">
            <form onSubmit={handleApplyFilters} className="flex-1 overflow-y-auto space-y-4 pb-1 pr-1">
              
              {/* Dynamic Filter Inputs */}
              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-md space-y-3">
                <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-50 pb-2">
                  <SlidersHorizontal size={14} className="text-sky-500" />
                  <span>Dynamic Query Filters</span>
                </h3>

                {filterDefinitions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-6 text-slate-400 border border-dashed border-slate-100 rounded-xl">
                    <AlertCircle size={24} className="stroke-1 text-slate-350" />
                    <p className="mt-1 text-[10px] text-center">No active dynamic filters configured in Settings.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filterDefinitions.map((def) => {
                      const val = filterValues[def.id] || { val1: '', val2: '' }
                      
                      return (
                        <div key={def.id} className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                            {def.filter_name}
                          </label>

                          {/* Render Inputs dynamically */}
                          {def.filter_type === 'date_range' && (
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="date"
                                value={val.val1 || ''}
                                onChange={(e) => handleFilterInputChange(def.id, 'val1', e.target.value)}
                                className="rounded-xl border border-slate-200 bg-white p-1.5 text-xs outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20"
                                placeholder="Start"
                              />
                              <input
                                type="date"
                                value={val.val2 || ''}
                                onChange={(e) => handleFilterInputChange(def.id, 'val2', e.target.value)}
                                className="rounded-xl border border-slate-200 bg-white p-1.5 text-xs outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20"
                                placeholder="End"
                              />
                            </div>
                          )}

                          {def.filter_type === 'number_range' && (
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="number"
                                step="any"
                                value={val.val1 || ''}
                                onChange={(e) => handleFilterInputChange(def.id, 'val1', e.target.value)}
                                className="rounded-xl border border-slate-200 bg-white p-1.5 text-xs outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20"
                                placeholder="Min"
                              />
                              <input
                                type="number"
                                step="any"
                                value={val.val2 || ''}
                                onChange={(e) => handleFilterInputChange(def.id, 'val2', e.target.value)}
                                className="rounded-xl border border-slate-200 bg-white p-1.5 text-xs outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20"
                                placeholder="Max"
                              />
                            </div>
                          )}

                          {def.filter_type === 'dropdown' && (
                            <select
                              value={val.val1 || ''}
                              onChange={(e) => handleFilterInputChange(def.id, 'val1', e.target.value)}
                              className="w-full rounded-xl border border-slate-200 bg-white p-1.5 text-xs outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20"
                            >
                              <option value="">-- Choose Option --</option>
                              {(() => {
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

                          {(def.filter_type === 'exact_match' || def.filter_type === 'contains') && (
                            <input
                              type="text"
                              value={val.val1 || ''}
                              onChange={(e) => handleFilterInputChange(def.id, 'val1', e.target.value)}
                              placeholder={def.filter_type === 'contains' ? 'Contains...' : 'Exact match...'}
                              className="w-full rounded-xl border border-slate-200 bg-white p-1.5 text-xs outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20"
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Calculations Config Panel */}
              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-md space-y-3">
                <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-50 pb-2">
                  <Calculator size={14} className="text-sky-500" />
                  <span>Calculations & Statistics</span>
                </h3>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-500 block">Sum Column</label>
                    <select
                      value={aggConfig.sum_column}
                      onChange={(e) => setAggConfig({ ...aggConfig, sum_column: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-white p-1.5 text-xs outline-none focus:border-sky-500"
                    >
                      <option value="">-- None --</option>
                      {columns.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-500 block">Avg Column</label>
                    <select
                      value={aggConfig.avg_column}
                      onChange={(e) => setAggConfig({ ...aggConfig, avg_column: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-white p-1.5 text-xs outline-none focus:border-sky-500"
                    >
                      <option value="">-- None --</option>
                      {columns.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-500 block">Min Column</label>
                      <select
                        value={aggConfig.min_column}
                        onChange={(e) => setAggConfig({ ...aggConfig, min_column: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 bg-white p-1.5 text-xs outline-none focus:border-sky-500"
                      >
                        <option value="">-- None --</option>
                        {columns.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-500 block">Max Column</label>
                      <select
                        value={aggConfig.max_column}
                        onChange={(e) => setAggConfig({ ...aggConfig, max_column: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 bg-white p-1.5 text-xs outline-none focus:border-sky-500"
                      >
                        <option value="">-- None --</option>
                        {columns.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Cargo weight filter */}
                <div className="border-t border-slate-50 pt-3 space-y-2">
                  <h4 className="text-[10px] font-bold text-slate-700 flex items-center gap-1">
                    <span>Specific Weight Counter</span>
                    <HelpCircle size={11} className="text-slate-400 cursor-pointer" data-tooltip="Count parcels with specific kg ranges (e.g. 15 to 25 kg)" />
                  </h4>

                  <div className="space-y-2">
                    <div className="space-y-1">
                      <label className="text-[9px] font-semibold text-slate-400 uppercase">Weight Column</label>
                      <select
                        value={aggConfig.weight_column}
                        onChange={(e) => setAggConfig({ ...aggConfig, weight_column: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 bg-white p-1.5 text-xs outline-none focus:border-sky-500"
                      >
                        <option value="">-- Select --</option>
                        {columns.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[9px] font-semibold text-slate-450 uppercase">Min Weight (kg)</label>
                        <input
                          type="number"
                          step="any"
                          value={aggConfig.weight_min}
                          onChange={(e) => setAggConfig({ ...aggConfig, weight_min: e.target.value })}
                          className="w-full rounded-xl border border-slate-200 bg-white p-1.5 text-xs outline-none focus:border-sky-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-semibold text-slate-455 uppercase">Max Weight (kg)</label>
                        <input
                          type="number"
                          step="any"
                          value={aggConfig.weight_max}
                          onChange={(e) => setAggConfig({ ...aggConfig, weight_max: e.target.value })}
                          className="w-full rounded-xl border border-slate-200 bg-white p-1.5 text-xs outline-none focus:border-sky-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>

          {/* Right Panel: Aggregates and Data Table */}
          <div className="lg:col-span-8 flex flex-col h-full overflow-hidden space-y-4 pb-1 pr-1">
            
            {/* Aggregation Summary Cards */}
            {aggregates && (
              <div className="shrink-0 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                  <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Filtered Count</p>
                  <p className="mt-0.5 text-base font-bold text-slate-800">{aggregates.total_count}</p>
                </div>
                {aggregates.sum_val !== undefined && aggregates.sum_val !== null && (
                  <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                    <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Sum Total</p>
                    <p className="mt-0.5 text-base font-bold text-slate-800 font-mono">
                      {Number(aggregates.sum_val).toFixed(2)}
                    </p>
                  </div>
                )}
                {aggregates.avg_val !== undefined && aggregates.avg_val !== null && (
                  <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                    <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Average</p>
                    <p className="mt-0.5 text-base font-bold text-slate-800 font-mono">
                      {Number(aggregates.avg_val).toFixed(2)}
                    </p>
                  </div>
                )}
                {aggregates.min_val !== undefined && aggregates.min_val !== null && (
                  <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                    <p className="text-[9px] font-semibold text-slate-450 uppercase tracking-wider">Min / Max</p>
                    <p className="mt-0.5 text-[11px] font-bold text-slate-800 font-mono leading-tight">
                      Min: {Number(aggregates.min_val).toFixed(2)}
                      <br />
                      Max: {Number(aggregates.max_val).toFixed(2)}
                    </p>
                  </div>
                )}
                {aggregates.parcel_range_count !== undefined && aggregates.parcel_range_count !== null && (
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/20 p-3 shadow-sm col-span-2 sm:col-span-1">
                    <p className="text-[9px] font-semibold text-emerald-600 uppercase tracking-wider">PH Weight Count</p>
                    <p className="mt-0.5 text-base font-bold text-emerald-800 font-mono">
                      {aggregates.parcel_range_count}
                    </p>
                    <p className="text-[8px] text-emerald-500">
                      Range: {aggConfig.weight_min}-{aggConfig.weight_max} kg
                    </p>
                  </div>
                )}
              </div>
            )}

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
                    No records match the active filters, or the dataset is empty. Use the filters on the left to query and calculate statistics.
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
                          <tr key={row.id} className="hover:bg-slate-50/50 transition-all font-mono">
                            <td className="py-2 px-3 text-slate-400 font-sans">{row.row_index + 1}</td>
                            {columns.map((col) => (
                              <td key={col} className="py-2 px-3 truncate max-w-[150px]" title={formatCellValue(col, row.data[col])}>
                                {formatCellValue(col, row.data[col])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalRows > limit && (
                    <div className="shrink-0 flex items-center justify-between border-t border-slate-50 pt-3 text-[10px] text-slate-500 font-semibold bg-white">
                      <span>
                        Showing {(currentPage - 1) * limit + 1} to {Math.min(currentPage * limit, totalRows)} of{' '}
                        {totalRows} records
                      </span>
                      <div className="flex gap-2">
                        <button
                          disabled={currentPage === 1}
                          onClick={() => handlePageChange(currentPage - 1)}
                          className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 hover:bg-slate-50 transition disabled:opacity-50"
                        >
                          <ChevronLeft size={12} />
                          <span>Previous</span>
                        </button>
                        <button
                          disabled={currentPage * limit >= totalRows}
                          onClick={() => handlePageChange(currentPage + 1)}
                          className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 hover:bg-slate-50 transition disabled:opacity-50"
                        >
                          <span>Next</span>
                          <ChevronRight size={12} />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
