import React, { useState, useEffect } from 'react'
import { DatabaseZap, Upload, Search, Trash2, CheckCircle2, AlertCircle, FileText, ArrowRight, Loader2 } from 'lucide-react'
import ConfirmDialog from '../components/ui/ConfirmDialog'

export default function DataImportPage() {
  const [datasets, setDatasets] = useState([])
  const [filePath, setFilePath] = useState('')
  const [description, setDescription] = useState('')
  
  const [isUploading, setIsUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState({ type: '', message: '' })
  const [isLoading, setIsLoading] = useState(true)

  // Confirm delete dialog state
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [datasetToDelete, setDatasetToDelete] = useState(null)

  const fetchDatasets = async () => {
    try {
      const res = await window.api.getDatasets()
      setDatasets(res || [])
    } catch (err) {
      console.error('Failed to fetch datasets:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchDatasets()
  }, [])

  const handleBrowseFile = async () => {
    setUploadStatus({ type: '', message: '' })
    try {
      const res = await window.api.openFileDialog({
        title: 'Select CSV or Excel Dataset to Import',
        properties: ['openFile'],
        filters: [{ name: 'Datasets', extensions: ['csv', 'xlsx', 'xls'] }]
      })

      const path = typeof res === 'object' ? res.filePaths?.[0] : res?.[0]
      const isCanceled = typeof res === 'object' ? res.canceled : !path

      if (isCanceled || !path) return
      setFilePath(path)
    } catch (err) {
      console.error(err)
      setUploadStatus({ type: 'error', message: 'Failed to browse local files.' })
    }
  }

  const handleImportSubmit = async (e) => {
    e.preventDefault()
    if (!filePath) return

    setIsUploading(true)
    setUploadStatus({ type: '', message: '' })

    try {
      const res = await window.api.importDataset({
        filePath,
        description: description.trim()
      })

      if (res.success) {
        setUploadStatus({
          type: 'success',
          message: `Successfully imported "${res.fileName}" with ${res.rowCount} rows!`
        })
        setFilePath('')
        setDescription('')
        fetchDatasets()
        
        // Auto-clear success message after 4s
        setTimeout(() => setUploadStatus({ type: '', message: '' }), 4000)
      } else {
        setUploadStatus({
          type: 'error',
          message: res.message || 'Import failed. Check file format.'
        })
      }
    } catch (err) {
      console.error(err)
      setUploadStatus({ type: 'error', message: 'IPC error: Failed to upload dataset.' })
    } finally {
      setIsUploading(false)
    }
  }

  const handleOpenDeleteConfirm = (dataset) => {
    setDatasetToDelete(dataset)
    setIsConfirmOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!datasetToDelete) return
    try {
      const res = await window.api.deleteDataset(datasetToDelete.id)
      if (res.success) {
        fetchDatasets()
      }
    } catch (err) {
      console.error('Failed to delete dataset:', err)
    } finally {
      setIsConfirmOpen(false)
      setDatasetToDelete(null)
    }
  }

  return (
    <div className="h-[calc(100vh-175px)] flex flex-col overflow-hidden space-y-4 pb-2 pr-2">
      <div className="flex-1 min-h-0 grid grid-cols-1 gap-6 lg:grid-cols-12 overflow-hidden pb-1 pr-1">
        {/* Left side upload form */}
        <div className="lg:col-span-5 flex flex-col h-full max-h-full pb-1 pr-1">
          <form onSubmit={handleImportSubmit} className="flex-1 overflow-y-auto rounded-2xl border border-slate-100 bg-white p-5 shadow-lg space-y-4 relative pr-1 pb-1">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-sky-500" />
            <h2 className="text-sm font-bold text-slate-800">Import New Dataset</h2>

            {uploadStatus.message && (
              <div className={`flex items-start gap-2 rounded-xl border p-3 text-xs leading-relaxed ${
                uploadStatus.type === 'success'
                  ? 'border-emerald-500/20 bg-emerald-50/50 text-emerald-700'
                  : 'border-red-500/20 bg-red-50/50 text-red-650'
              }`}>
                {uploadStatus.type === 'success' ? <CheckCircle2 size={14} className="shrink-0 mt-0.5" /> : <AlertCircle size={14} className="shrink-0 mt-0.5" />}
                <span>{uploadStatus.message}</span>
              </div>
            )}

            {/* Browser area */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-440 uppercase tracking-wide">File Path</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  placeholder="No file chosen..."
                  value={filePath}
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600 outline-none truncate"
                />
                <button
                  type="button"
                  onClick={handleBrowseFile}
                  disabled={isUploading}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
                >
                  Browse
                </button>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-440 uppercase tracking-wide">Description (Optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. June Parcel Delivery Data"
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                rows={2}
                disabled={isUploading}
              />
            </div>

            <button
              type="submit"
              disabled={!filePath || isUploading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 py-2 text-xs font-bold text-black shadow-md hover:bg-sky-600 transition active:scale-95 disabled:pointer-events-none disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Processing File...</span>
                </>
              ) : (
                <>
                  <Upload size={14} />
                  <span>Process Import</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right side history table */}
        <div className="lg:col-span-7 flex flex-col h-full overflow-hidden pb-1 pr-1">
          <div className="flex flex-col h-full border border-slate-100 bg-white p-5 shadow-lg rounded-2xl overflow-hidden">
            <h2 className="text-sm font-bold text-slate-800 shrink-0 mb-3">Dataset History</h2>

            {isLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-sky-500" />
              </div>
            ) : datasets.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 text-slate-400">
                <DatabaseZap size={36} className="stroke-1 animate-pulse" />
                <p className="mt-2 text-sm">No datasets have been imported yet.</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto overflow-x-auto pb-1 pr-1">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider text-[10px] sticky top-0 bg-white z-10 shadow-sm">
                      <th className="py-2.5 px-3 bg-white">File Name</th>
                      <th className="py-2.5 px-3 bg-white">Description</th>
                      <th className="py-2.5 px-3 bg-white">Rows</th>
                      <th className="py-2.5 px-3 bg-white">Import Date</th>
                      <th className="py-2.5 px-3 bg-white text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-slate-700 font-medium">
                    {datasets.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50/50 transition-all">
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <FileText size={14} className="text-slate-400 shrink-0" />
                            <div>
                              <p className="font-semibold text-slate-800 truncate max-w-[140px]" title={d.file_name}>
                                {d.file_name}
                              </p>
                              <p className="text-[9px] text-slate-400 truncate max-w-[140px]" title={d.original_file_path}>
                                Path: {d.original_file_path}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-slate-550 max-w-[120px] truncate" title={d.description}>
                          {d.description || 'N/A'}
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-650">{d.row_count}</td>
                        <td className="py-2 px-3 text-slate-450 font-mono text-[10px]">
                          {d.imported_at ? new Date(d.imported_at).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button
                            onClick={() => handleOpenDeleteConfirm(d)}
                            data-tooltip="Delete Dataset"
                            data-tooltip-pos="left"
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-650 transition"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Dataset"
        message={`Are you sure you want to delete "${datasetToDelete?.file_name}"? This will drop the dataset schema and delete all row items from the SQLite database permanently. Any custom calculations built on top of this dataset will be removed.`}
        confirmText="Delete Dataset"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  )
}
