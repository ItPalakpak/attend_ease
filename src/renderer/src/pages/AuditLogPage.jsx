import React, { useState, useEffect, useCallback } from 'react'
import { ScrollText, Search, FileWarning } from 'lucide-react'
import Pagination from '../components/ui/Pagination'

export default function AuditLogPage() {
  const [logs, setLogs] = useState([])
  const [filteredLogs, setFilteredLogs] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [isLoading, setIsLoading] = useState(true)

  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)

  const fetchLogs = useCallback(async () => {
    try {
      const res = await window.api.getAuditLogs()
      setLogs(res || [])
    } catch (err) {
      console.error('Failed to fetch audit logs:', err)
    } finally {
      setIsLoading(false)
      window.dispatchEvent(new Event('header-refresh-complete'))
    }
  }, [])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  // Listen for refresh from header
  useEffect(() => {
    const handler = () => fetchLogs()
    window.addEventListener('header-refresh', handler)
    return () => window.removeEventListener('header-refresh', handler)
  }, [fetchLogs])

  useEffect(() => {
    let result = logs
    const q = searchQuery.toLowerCase().trim()

    // Filter by search query
    if (q) {
      result = result.filter(
        (l) =>
          (l.details && l.details.toLowerCase().includes(q)) ||
          (l.performed_by && l.performed_by.toLowerCase().includes(q)) ||
          l.action.toLowerCase().includes(q) ||
          l.entity_type.toLowerCase().includes(q)
      )
    }

    // Filter by action category
    if (actionFilter !== 'all') {
      result = result.filter((l) => {
        const act = l.action.toUpperCase()
        if (actionFilter === 'ADD')
          return act.includes('ADD') || act.includes('CREATE') || act.includes('IMPORT')
        if (actionFilter === 'EDIT')
          return act.includes('UPDATE') || act.includes('EDIT') || act.includes('REGEN')
        if (actionFilter === 'DELETE') return act.includes('DELETE') || act.includes('REMOVE')
        return true
      })
    }

    setFilteredLogs(result)
    setCurrentPage(1)
  }, [logs, searchQuery, actionFilter])

  // Pagination Math
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedLogs = filteredLogs.slice(startIndex, endIndex)

  // Helper to color-code actions
  const getActionBadge = (action) => {
    const act = action.toUpperCase()
    let color = 'bg-slate-100 text-slate-700 border-slate-200'

    if (
      act.includes('ADD') ||
      act.includes('CREATE') ||
      act.includes('CLOCK') ||
      act.includes('IMPORT')
    ) {
      color = 'bg-emerald-50 text-emerald-700 border-emerald-100'
    } else if (
      act.includes('UPDATE') ||
      act.includes('EDIT') ||
      act.includes('REGENERATE') ||
      act.includes('CHANGE_PASSWORD') ||
      act.includes('RESTORE')
    ) {
      color = 'bg-blue-50 text-blue-700 border-blue-100'
    } else if (act.includes('DELETE') || act.includes('REMOVE') || act.includes('CLEAN')) {
      color = 'bg-red-50 text-red-700 border-red-100'
    }

    return (
      <span
        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ${color}`}
      >
        {action}
      </span>
    )
  }

  // Parse details json cleanly
  const renderDetails = (details) => {
    if (!details) return 'None'
    try {
      // If it's a JSON string
      if (typeof details === 'string' && (details.startsWith('{') || details.startsWith('['))) {
        const parsed = JSON.parse(details)

        // Flatten simple key value pairs
        return (
          <div className="max-w-xs space-y-0.5 text-xs text-slate-500 font-mono bg-slate-50 p-2 rounded-lg border border-slate-100 overflow-x-auto">
            {Object.entries(parsed).map(([key, val]) => (
              <div key={key} className="truncate">
                <span className="font-semibold text-slate-705">{key}:</span>{' '}
                {typeof val === 'object' ? JSON.stringify(val) : String(val)}
              </div>
            ))}
          </div>
        )
      }
      return <span className="text-slate-600 font-medium">{details}</span>
    } catch (e) {
      return (
        <span className="text-slate-500 font-mono text-xs truncate max-w-xs block">{details}</span>
      )
    }
  }

  return (
    <div className="h-[calc(100vh-211px)] flex flex-col overflow-hidden space-y-4 pb-2 pr-2">
      {/* Controls */}
      <div className="shrink-0 flex flex-col gap-4 sm:flex-row sm:items-center rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search size={18} />
          </span>
          <input
            type="text"
            placeholder="Search logs by operator, details, or entity..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-10 pr-4 text-xs outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-slate-400 shrink-0">
            Action Category:
          </span>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
          >
            <option value="all">All Actions</option>
            <option value="ADD">Create / Add</option>
            <option value="EDIT">Update / Edit</option>
            <option value="DELETE">Delete / Remove</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="flex-1 min-h-0 rounded-2xl border border-slate-100 bg-white p-5 shadow-lg flex flex-col overflow-hidden">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-sky-500" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 text-slate-400">
            <FileWarning size={36} className="stroke-1 animate-pulse" />
            <p className="mt-2 text-sm font-semibold">No audit logs found.</p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto overflow-x-auto pb-1 pr-1">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider text-[10px] sticky top-0 bg-white z-10 shadow-sm">
                    <th className="py-2.5 px-3 bg-white">Timestamp</th>
                    <th className="py-2.5 px-3 bg-white">Action</th>
                    <th className="py-2.5 px-3 bg-white">Entity Type</th>
                    <th className="py-2.5 px-3 bg-white">Details</th>
                    <th className="py-2.5 px-3 bg-white">Performed By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-slate-700">
                  {paginatedLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-all">
                      <td className="py-2 px-3 font-mono text-[10px] font-medium text-slate-500">
                        {log.performed_at ? new Date(log.performed_at).toLocaleString() : 'N/A'}
                      </td>
                      <td className="py-2 px-3">{getActionBadge(log.action)}</td>
                      <td className="py-2 px-3 font-semibold text-slate-650">{log.entity_type}</td>
                      <td className="py-2 px-3">{renderDetails(log.details)}</td>
                      <td className="py-2 px-3 font-bold text-slate-800">
                        {log.performed_by || 'System'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={currentPage}
              totalItems={filteredLogs.length}
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
