import React, { useState, useEffect } from 'react'
import { Plus, Search, Edit2, Trash2, ShieldAlert } from 'lucide-react'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import StatusBadge from '../components/ui/StatusBadge'

export default function RolesPage() {
  const [roles, setRoles] = useState([])
  const [filteredRoles, setFilteredRoles] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState('add') // 'add' or 'edit'
  const [currentRoleId, setCurrentRoleId] = useState(null)
  const [formData, setFormData] = useState({
    role_name: '',
    description: '',
    status: 'Active'
  })

  // ConfirmDialog State
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [roleToDelete, setRoleToDelete] = useState(null)

  const fetchRoles = async () => {
    try {
      const res = await window.api.getRoles()
      setRoles(res || [])
    } catch (err) {
      console.error('Failed to fetch roles:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchRoles()
  }, [])

  useEffect(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) {
      setFilteredRoles(roles)
    } else {
      setFilteredRoles(
        roles.filter(
          (r) =>
            r.role_name.toLowerCase().includes(q) ||
            r.description.toLowerCase().includes(q)
        )
      )
    }
  }, [roles, searchQuery])

  const handleOpenAddModal = () => {
    setModalMode('add')
    setFormData({ role_name: '', description: '', status: 'Active' })
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (role) => {
    setModalMode('edit')
    setCurrentRoleId(role.id)
    setFormData({
      role_name: role.role_name,
      description: role.description || '',
      status: role.status || 'Active'
    })
    setIsModalOpen(true)
  }

  const handleFormSubmit = async (e) => {
    e.preventDefault()
    if (!formData.role_name.trim()) return

    try {
      if (modalMode === 'add') {
        await window.api.addRole(formData)
      } else {
        await window.api.updateRole(currentRoleId, formData)
      }
      setIsModalOpen(false)
      fetchRoles()
    } catch (err) {
      console.error('Failed to save role:', err)
    }
  }

  const handleOpenDeleteConfirm = (role) => {
    setRoleToDelete(role)
    setIsConfirmOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!roleToDelete) return
    try {
      await window.api.deleteRole(roleToDelete.id)
      fetchRoles()
    } catch (err) {
      console.error('Failed to delete role:', err)
    } finally {
      setIsConfirmOpen(false)
      setRoleToDelete(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Role Management</h1>
          <p className="text-sm text-slate-500">Manage user roles and designations within the organization</p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-bold text-black shadow-md transition-all hover:bg-sky-600 active:scale-95"
        >
          <Plus size={16} />
          <span>Add Role</span>
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
            placeholder="Search roles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
          />
        </div>
      </div>

      {/* Roles Table */}
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-lg">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-sky-500" />
          </div>
        ) : filteredRoles.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 text-slate-400">
            <ShieldAlert size={36} className="stroke-1" />
            <p className="mt-2 text-sm">No roles found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-4">Role Name</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created At</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-sm text-slate-700">
                {filteredRoles.map((role) => (
                  <tr key={role.id} className="transition-all hover:bg-slate-50">
                    <td className="py-3.5 px-4 font-semibold text-slate-800">{role.role_name}</td>
                    <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate">{role.description || 'No description'}</td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={role.status} />
                    </td>
                    <td className="py-3.5 px-4 text-slate-450 font-mono text-xs">
                      {role.created_at ? new Date(role.created_at).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleOpenEditModal(role)}
                          className="rounded-lg p-1.5 text-slate-550 hover:bg-slate-100 hover:text-sky-600 transition"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleOpenDeleteConfirm(role)}
                          className="rounded-lg p-1.5 text-slate-550 hover:bg-red-50 hover:text-red-600 transition"
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
        title={modalMode === 'add' ? 'Add New Role' : 'Edit Role'}
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-555">Role Name *</label>
            <input
              type="text"
              required
              value={formData.role_name}
              onChange={(e) => setFormData({ ...formData, role_name: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
              placeholder="e.g. Software Engineer"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-555">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
              placeholder="Provide a brief description of the role's responsibilities"
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
        title="Delete Role"
        message={`Are you sure you want to delete the role "${roleToDelete?.role_name}"? This action cannot be undone and may affect staff members currently assigned to this role.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  )
}
