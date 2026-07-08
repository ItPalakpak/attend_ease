import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Eye, Edit2, Trash2, CreditCard, Users2, ShieldAlert } from 'lucide-react'
import StatusBadge from '../components/ui/StatusBadge'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Pagination from '../components/ui/Pagination'

export default function StaffListPage() {
  const [staffList, setStaffList] = useState([])
  const [filteredStaff, setFilteredStaff] = useState([])
  const [departments, setDepartments] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDept, setSelectedDept] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [isLoading, setIsLoading] = useState(true)

  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  // ConfirmDialog State
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [staffToDelete, setStaffToDelete] = useState(null)

  const navigate = useNavigate()

  const fetchData = async () => {
    try {
      const staffRes = await window.api.getStaffList()
      const deptRes = await window.api.getActiveDepartments()
      setStaffList(staffRes || [])
      setDepartments(deptRes || [])
    } catch (err) {
      console.error('Failed to fetch staff list/departments:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    let result = staffList

    // Apply Search
    const q = searchQuery.toLowerCase().trim()
    if (q) {
      result = result.filter(
        (s) =>
          s.first_name.toLowerCase().includes(q) ||
          s.last_name.toLowerCase().includes(q) ||
          (s.middle_name && s.middle_name.toLowerCase().includes(q)) ||
          s.staff_id.toLowerCase().includes(q) ||
          (s.employee_number && s.employee_number.toLowerCase().includes(q))
      )
    }

    // Apply Department Filter
    if (selectedDept !== 'all') {
      result = result.filter((s) => String(s.department_id) === selectedDept)
    }

    // Apply Status Filter
    if (selectedStatus !== 'all') {
      result = result.filter((s) => s.employment_status === selectedStatus)
    }

    setFilteredStaff(result)
    setCurrentPage(1) // Reset to first page when filtering updates
  }, [staffList, searchQuery, selectedDept, selectedStatus])

  // Pagination Math
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedStaff = filteredStaff.slice(startIndex, endIndex)

  const handleOpenDeleteConfirm = (staff) => {
    setStaffToDelete(staff)
    setIsConfirmOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!staffToDelete) return
    try {
      const res = await window.api.deleteStaff(staffToDelete.id)
      if (res.success) {
        fetchData()
      }
    } catch (err) {
      console.error('Failed to delete staff:', err)
    } finally {
      setIsConfirmOpen(false)
      setStaffToDelete(null)
    }
  }

  return (
    <div className="h-[calc(100vh-211px)] flex flex-col overflow-hidden space-y-4 pb-2 pr-2">
      {/* Controls panel */}
      <div className="shrink-0 flex flex-col gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm lg:flex-row lg:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search size={18} />
          </span>
          <input
            type="text"
            placeholder="Search by name, staff ID, or employee number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-10 pr-4 text-xs outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-slate-400">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
            >
              <option value="all">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Resigned">Resigned</option>
              <option value="Terminated">Terminated</option>
            </select>
          </div>
        </div>

        {/* Add New Staff */}
        <button
          onClick={() => navigate('/staff/new')}
          className="flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-xs font-bold text-black shadow-md transition-all hover:bg-sky-600 active:scale-95 shrink-0"
        >
          <Plus size={14} />
          <span>Add New Staff</span>
        </button>
      </div>

      {/* Staff Table */}
      <div className="flex-1 min-h-0 rounded-2xl border border-slate-100 bg-white p-5 shadow-lg flex flex-col overflow-hidden">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-sky-500" />
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 text-slate-400">
            <Users2 size={36} className="stroke-1" />
            <p className="mt-2 text-sm">No staff records found matching the criteria.</p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto overflow-x-auto pb-1 pr-1">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider text-[10px] sticky top-0 bg-white z-10 shadow-sm">
                    <th className="py-2.5 px-3 bg-white">Staff</th>
                    <th className="py-2.5 px-3 bg-white">Staff ID</th>
                    <th className="py-2.5 px-3 bg-white">Position</th>
                    <th className="py-2.5 px-3 bg-white">Status</th>
                    <th className="py-2.5 px-3 bg-white text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-slate-700">
                  {paginatedStaff.map((staff) => (
                    <tr key={staff.id} className="group transition-all hover:bg-slate-50/50">
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-3">
                          <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full ring-2 ring-slate-100">
                            {staff.photo_path ? (
                              <img
                                src={`media:///${staff.photo_path.replace(/\\/g, '/')}`}
                                alt={staff.first_name}
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  e.target.style.display = 'none'
                                  e.target.nextSibling.style.display = 'flex'
                                }}
                              />
                            ) : null}
                            <div
                              className={`absolute inset-0 flex items-center justify-center bg-slate-100 text-[10px] font-bold text-slate-650 ${staff.photo_path ? 'hidden' : ''}`}
                            >
                              {staff.first_name?.[0]}
                              {staff.last_name?.[0]}
                            </div>
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800 group-hover:text-sky-600 transition">
                              {staff.first_name} {staff.last_name}
                            </p>
                            <p className="text-[9px] text-slate-400">
                              Emp No: {staff.employee_number || 'N/A'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-3 font-mono text-[10px] font-semibold text-slate-600">
                        {staff.formatted_id || staff.staff_id}
                      </td>
                      <td className="py-2 px-3 text-slate-500 font-medium">
                        {staff.role_name || 'Unassigned'}
                      </td>
                      <td className="py-2 px-3">
                        <StatusBadge status={staff.employment_status} />
                      </td>
                      <td className="py-2 px-3 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => navigate(`/staff/${staff.id}`)}
                            data-tooltip="View Profile"
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-sky-600 transition"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={() => navigate(`/staff/edit/${staff.id}`)}
                            data-tooltip="Edit Staff"
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-sky-600 transition"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => navigate(`/id-cards/${staff.id}`)}
                            data-tooltip="ID Card"
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-sky-600 transition"
                          >
                            <CreditCard size={14} />
                          </button>
                          <button
                            onClick={() => handleOpenDeleteConfirm(staff)}
                            data-tooltip="Delete Staff"
                            data-tooltip-pos="left"
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={currentPage}
              totalItems={filteredStaff.length}
              itemsPerPage={itemsPerPage}
              onChangePage={setCurrentPage}
              onChangeItemsPerPage={setItemsPerPage}
            />
          </>
        )}
      </div>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Staff Record"
        message={`Are you sure you want to delete the record of "${staffToDelete?.first_name} ${staffToDelete?.last_name}"? This action is permanent, deleting their profile, photo, QR code, and all associated role history. It will NOT delete historical attendance logs, but they will become orphaned.`}
        confirmText="Delete Permanently"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  )
}
