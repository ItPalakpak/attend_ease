import React, { useState, useEffect } from 'react'
import { Plus, Search, Edit2, Trash2, Building } from 'lucide-react'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import StatusBadge from '../components/ui/StatusBadge'

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState([])
  const [filteredDepartments, setFilteredDepartments] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState('add') // 'add' or 'edit'
  const [currentDeptId, setCurrentDeptId] = useState(null)
  const [formData, setFormData] = useState({
    department_name: '',
    description: '',
    status: 'Active'
  })

  // ConfirmDialog State
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [deptToDelete, setDeptToDelete] = useState(null)

  const fetchDepartments = async () => {
    try {
      const res = await window.api.getDepartments()
      setDepartments(res || [])
    } catch (err) {
      console.error('Failed to fetch departments:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchDepartments()
  }, [])

  useEffect(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) {
      setFilteredDepartments(departments)
    } else {
      setFilteredDepartments(
        departments.filter(
          (d) =>
            d.department_name.toLowerCase().includes(q) ||
            d.description.toLowerCase().includes(q)
        )
      )
    }
  }, [departments, searchQuery])

  const handleOpenAddModal = () => {
    setModalMode('add')
    setFormData({ department_name: '', description: '', status: 'Active' })
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (dept) => {
    setModalMode('edit')
    setCurrentDeptId(dept.id)
    setFormData({
      department_name: dept.department_name,
      description: dept.description || '',
      status: dept.status || 'Active'
    })
    setIsModalOpen(true)
  }

  const handleFormSubmit = async (e) => {
    e.preventDefault()
    if (!formData.department_name.trim()) return

    try {
      if (modalMode === 'add') {
        await window.api.addDepartment(formData)
      } else {
        await window.api.updateDepartment(currentDeptId, formData)
      }
      setIsModalOpen(false)
      fetchDepartments()
    } catch (err) {
      console.error('Failed to save department:', err)
    }
  }

  const handleOpenDeleteConfirm = (dept) => {
    setDeptToDelete(dept)
    setIsConfirmOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!deptToDelete) return
    try {
      await window.api.deleteDepartment(deptToDelete.id)
      fetchDepartments()
    } catch (err) {
      console.error('Failed to delete department:', err)
    } finally {
      setIsConfirmOpen(false)
      setDeptToDelete(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Department Management</h1>
          <p className="text-sm text-slate-500">Manage organizational divisions and departments</p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-bold text-black shadow-md transition-all hover:bg-sky-600 active:scale-95"
        >
          <Plus size={16} />
          <span>Add Department</span>
        </button>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search size={18} />
          </span>
          <input
            type="text"
            placeholder="Search departments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
          />
        </div>
      </div>

      {/* Departments Table */}
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-lg">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-sky-500" />
          </div>
        ) : filteredDepartments.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 text-slate-400">
            <Building size={36} className="stroke-1" />
            <p className="mt-2 text-sm">No departments found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-4">Department Name</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created At</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-sm text-slate-700">
                {filteredDepartments.map((dept) => (
                  <tr key={dept.id} className="transition-all hover:bg-slate-50">
                    <td className="py-3.5 px-4 font-semibold text-slate-800">{dept.department_name}</td>
                    <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate">{dept.description || 'No description'}</td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={dept.status} />
                    </td>
                    <td className="py-3.5 px-4 text-slate-450 font-mono text-xs">
                      {dept.created_at ? new Date(dept.created_at).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleOpenEditModal(dept)}
                          className="rounded-lg p-1.5 text-slate-555 hover:bg-slate-100 hover:text-sky-600 transition"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleOpenDeleteConfirm(dept)}
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
        title={modalMode === 'add' ? 'Add New Department' : 'Edit Department'}
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-555">Department Name *</label>
            <input
              type="text"
              required
              value={formData.department_name}
              onChange={(e) => setFormData({ ...formData, department_name: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
              placeholder="e.g. Human Resources"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-555">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
              placeholder="Provide a brief description of the department"
              rows={3}
            />
          </div>

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
              className="rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-bold text-black shadow-md hover:bg-sky-600 transition"
            >
              Save
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Department"
        message={`Are you sure you want to delete the department "${deptToDelete?.department_name}"? This action cannot be undone and may affect staff members currently assigned to this department.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  )
}
