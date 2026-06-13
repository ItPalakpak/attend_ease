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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dataset Import</h1>
        <p className="text-sm text-slate-500">Import CSV or Excel sheets for advanced filtering and calculations (parcels weight counting)</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left side upload form */}
        <div className="lg:col-span-5 space-y-6">
          <form onSubmit={handleImportSubmit} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-lg space-y-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-full bg-sky-500" />
            <h2 className="text-base font-bold text-slate-800">Import New Dataset</h2>

            {uploadStatus.message && (
              <div className={`flex items-start gap-2 rounded-xl border p-4 text-xs leading-relaxed ${
                uploadStatus.type === 'success'
                  ? 'border-emerald-500/20 bg-emerald-50/50 text-emerald-700'
                  : 'border-red-500/20 bg-red-50/50 text-red-650'
              }`}>
                {uploadStatus.type === 'success' ? <CheckCircle2 size={16} className="shrink-0 mt-0.5" /> : <AlertCircle size={16} className="shrink-0 mt-0.5" />}
                <span>{uploadStatus.message}</span>
              </div>
            )}

            {/* Browser area */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-450 uppercase tracking-wide">File Path</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  placeholder="No file chosen..."
                  value={filePath}
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 outline-none truncate"
                />
                <button
                  type="button"
                  onClick={handleBrowseFile}
                  disabled={isUploading}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
                >
                  Browse
                </button>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-450 uppercase tracking-wide">Description (Optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. June Parcel Delivery Data"
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                rows={3}
                disabled={isUploading}
              />
            </div>

            <button
              type="submit"
              disabled={!filePath || isUploading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 py-3 text-sm font-bold text-black shadow-md hover:bg-sky-600 transition active:scale-95 disabled:pointer-events-none disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processing File...</span>
                </>
              ) : (
                <>
                  <Upload size={16} />
                  <span>Process Import</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right side history table */}
        <div className="lg:col-span-7">
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-lg space-y-4">
            <h2 className="text-base font-bold text-slate-800">Dataset History</h2>

            {isLoading ? (
              <div className="flex h-40 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-sky-500" />
              </div>
            ) : datasets.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 text-slate-400">
                <DatabaseZap size={36} className="stroke-1 animate-pulse" />
                <p className="mt-2 text-sm">No datasets have been imported yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wider text-slate-400">
                      <th className="py-2.5 px-3">File Name</th>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3">Rows</th>
                      <th className="py-2.5 px-3">Import Date</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-xs text-slate-700">
                    {datasets.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50 transition-all">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <FileText size={16} className="text-slate-400 shrink-0" />
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
                        <td className="py-3 px-3 text-slate-500 max-w-[120px] truncate" title={d.description}>
                          {d.description || 'N/A'}
                        </td>
                        <td className="py-3 px-3 font-mono font-semibold text-slate-650">{d.row_count}</td>
                        <td className="py-3 px-3 text-slate-450 font-mono">
                          {d.imported_at ? new Date(d.imported_at).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => handleOpenDeleteConfirm(d)}
                            title="Delete Dataset"
                            className="rounded-lg p-1.5 text-slate-555 hover:bg-red-50 hover:text-red-650 transition"
                          >
                            <Trash2 size={16} />
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
