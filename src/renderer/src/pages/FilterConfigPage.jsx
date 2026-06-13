import React, { useState, useEffect } from 'react'
import { Plus, Sliders, Edit2, Trash2, SlidersHorizontal, AlertCircle } from 'lucide-react'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import StatusBadge from '../components/ui/StatusBadge'

export default function FilterConfigPage() {
  const [filters, setFilters] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState('add') // 'add' or 'edit'
  const [currentFilterId, setCurrentFilterId] = useState(null)
  
  const [formData, setFormData] = useState({
    filter_name: '',
    column_key: '',
    filter_type: 'contains',
    options_raw: '', // Text area raw content (one per line)
    display_order: 0,
    status: 'Active'
  })

  // ConfirmDialog State
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [filterToDelete, setFilterToDelete] = useState(null)

  const fetchFilters = async () => {
    try {
      const res = await window.api.getFilterDefinitions()
      setFilters(res || [])
    } catch (err) {
      console.error('Failed to fetch filter definitions:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchFilters()
  }, [])

  const handleOpenAddModal = () => {
    setModalMode('add')
    setFormData({
      filter_name: '',
      column_key: '',
      filter_type: 'contains',
      options_raw: '',
      display_order: filters.length + 1,
      status: 'Active'
    })
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (filter) => {
    setModalMode('edit')
    setCurrentFilterId(filter.id)
    
    // Convert options JSON array back to raw linebreaks for editing
    let rawOptions = ''
    try {
      const parsed = JSON.parse(filter.options_json)
      if (Array.isArray(parsed)) {
        rawOptions = parsed.join('\n')
      }
    } catch (e) {
      console.error('Failed to parse options JSON:', e)
    }

    setFormData({
      filter_name: filter.filter_name,
      column_key: filter.column_key,
      filter_type: filter.filter_type,
      options_raw: rawOptions,
      display_order: filter.display_order || 0,
      status: filter.status || 'Active'
    })
    setIsModalOpen(true)
  }

  const handleFormSubmit = async (e) => {
    e.preventDefault()
    if (!formData.filter_name.trim() || !formData.column_key.trim()) return

    // Convert raw linebreaks to JSON array
    const optionsArray = formData.options_raw
      .split('\n')
      .map((opt) => opt.trim())
      .filter(Boolean)

    const payload = {
      filter_name: formData.filter_name.trim(),
      column_key: formData.column_key.trim(),
      filter_type: formData.filter_type,
      options_json: JSON.stringify(optionsArray),
      display_order: Number(formData.display_order) || 0,
      status: formData.status
    }

    try {
      if (modalMode === 'add') {
        await window.api.addFilterDefinition(payload)
      } else {
        await window.api.updateFilterDefinition(currentFilterId, payload)
      }
      setIsModalOpen(false)
      fetchFilters()
    } catch (err) {
      console.error('Failed to save filter definition:', err)
    }
  }

  const handleOpenDeleteConfirm = (filter) => {
    setFilterToDelete(filter)
    setIsConfirmOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!filterToDelete) return
    try {
      await window.api.deleteFilterDefinition(filterToDelete.id)
      fetchFilters()
    } catch (err) {
      console.error('Failed to delete filter:', err)
    } finally {
      setIsConfirmOpen(false)
      setFilterToDelete(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dynamic Filter Configuration</h1>
          <p className="text-sm text-slate-500">Configure which spreadsheet columns are filterable in the Data Analytics dashboard</p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-sky-500/20 transition-all hover:bg-sky-600 active:scale-95"
        >
          <Plus size={16} />
          <span>Add Filter</span>
        </button>
      </div>

      {/* Warning Box */}
      <div className="flex items-start gap-3 rounded-2xl border border-sky-500/10 bg-sky-50/30 p-5 text-sm leading-relaxed text-sky-850">
        <AlertCircle size={20} className="text-sky-500 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-sky-900">How Dynamic Filters Work</h4>
          <p className="mt-1 text-xs text-sky-800">
            Dynamic filters scan the JSON properties of imported spreadsheets. The <strong>Column Key</strong> must match the column header in your Excel or CSV file exactly (case-sensitive) for filters to match row data correctly.
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-lg">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-sky-500" />
          </div>
        ) : filters.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 text-slate-400">
            <Sliders size={36} className="stroke-1 animate-pulse" />
            <p className="mt-2 text-sm">No dynamic filters configured yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-4">Display Order</th>
                  <th className="py-3 px-4">Filter Name</th>
                  <th className="py-3 px-4">Column Key</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-sm text-slate-705">
                {filters.map((filter) => (
                  <tr key={filter.id} className="hover:bg-slate-50 transition-all">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-400">{filter.display_order}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800">{filter.filter_name}</td>
                    <td className="py-3.5 px-4 font-mono text-xs text-sky-655">{filter.column_key}</td>
                    <td className="py-3.5 px-4">
                      <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 uppercase">
                        {(filter.filter_type || '').replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={filter.status} />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleOpenEditModal(filter)}
                          className="rounded-lg p-1.5 text-slate-555 hover:bg-slate-100 hover:text-sky-600 transition"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleOpenDeleteConfirm(filter)}
                          className="rounded-lg p-1.5 text-slate-555 hover:bg-red-50 hover:text-red-600 transition"
                        >
                          <Trash2 size={16} />
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

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalMode === 'add' ? 'Add Filter Definition' : 'Edit Filter Definition'}
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-555">Filter Display Name *</label>
              <input
                type="text"
                required
                value={formData.filter_name}
                onChange={(e) => setFormData({ ...formData, filter_name: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                placeholder="e.g. Weight Filter"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-555">Column Header Key *</label>
              <input
                type="text"
                required
                value={formData.column_key}
                onChange={(e) => setFormData({ ...formData, column_key: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                placeholder="e.g. weight_kg"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-555">Filter Type</label>
              <select
                value={formData.filter_type}
                onChange={(e) => setFormData({ ...formData, filter_type: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
              >
                <option value="contains">Contains (Text search)</option>
                <option value="exact_match">Exact Match (Text/Code)</option>
                <option value="number_range">Numeric Range (Min/Max)</option>
                <option value="date_range">Date Range (Start/End)</option>
                <option value="dropdown">Dropdown Options</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-555">Display Order</label>
              <input
                type="number"
                value={formData.display_order}
                onChange={(e) => setFormData({ ...formData, display_order: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
              />
            </div>
          </div>

          {formData.filter_type === 'dropdown' && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-555">Dropdown Options (one per line)</label>
              <textarea
                value={formData.options_raw}
                onChange={(e) => setFormData({ ...formData, options_raw: e.target.value })}
                placeholder="Option A&#10;Option B&#10;Option C"
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                rows={4}
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-555">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-sky-500/10 hover:bg-sky-600 transition"
            >
              Save Definition
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Filter Definition"
        message={`Are you sure you want to delete the filter definition "${filterToDelete?.filter_name}"? Deleting it will remove the filter field from the Data Analytics dashboard.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  )
}
