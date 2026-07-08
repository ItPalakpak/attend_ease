import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, Upload, User, Image as ImageIcon, X } from 'lucide-react'

export default function StaffFormPage() {
  const { id } = useParams() // For edit mode
  const isEditMode = !!id
  const navigate = useNavigate()

  const [roles, setRoles] = useState([])
  const [departments, setDepartments] = useState([])
  const [isLoading, setIsLoading] = useState(isEditMode)
  const [previewSrc, setPreviewSrc] = useState(null) // base64 data URL for photo preview

  const [formData, setFormData] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    gender: 'Male',
    birth_date: '',
    employee_number: '',
    role_id: '',
    department_id: '',
    date_hired: '',
    employment_status: 'Active',
    contact_number: '',
    email: '',
    address: '',
    emergency_contact_name: '',
    emergency_contact_number: '',
    photo_path: ''
  })

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const activeRoles = await window.api.getActiveRoles()
        const activeDepts = await window.api.getActiveDepartments()
        setRoles(activeRoles || [])
        setDepartments(activeDepts || [])

        if (isEditMode) {
          const staff = await window.api.getStaffById(id)
          if (staff) {
            setFormData({
              first_name: staff.first_name || '',
              middle_name: staff.middle_name || '',
              last_name: staff.last_name || '',
              gender: staff.gender || 'Male',
              birth_date: staff.birth_date || '',
              employee_number: staff.employee_number || '',
              role_id: staff.role_id || '',
              department_id: staff.department_id || '',
              date_hired: staff.date_hired || '',
              employment_status: staff.employment_status || 'Active',
              contact_number: staff.contact_number || '',
              email: staff.email || '',
              address: staff.address || '',
              emergency_contact_name: staff.emergency_contact_name || '',
              emergency_contact_number: staff.emergency_contact_number || '',
              photo_path: staff.photo_path || ''
            })
            // Load existing photo as base64 for preview
            if (staff.photo_path) {
              const b64 = await window.api.readFileAsBase64(staff.photo_path)
              if (b64) setPreviewSrc(b64)
            }
          }
        }
      } catch (err) {
        console.error('Failed to load form metadata/staff:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchMetadata()
  }, [id, isEditMode])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSelectPhoto = async () => {
    try {
      const result = await window.api.openFileDialog({
        title: 'Select Staff Photo',
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: ['jpg', 'png', 'jpeg', 'webp'] }]
      })

      if (result && !result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0]
        setFormData((prev) => ({ ...prev, photo_path: filePath }))
        // Generate base64 preview immediately so it shows in the form
        const b64 = await window.api.readFileAsBase64(filePath)
        if (b64) setPreviewSrc(b64)
      }
    } catch (err) {
      console.error('Error selecting photo:', err)
    }
  }

  const handleClearPhoto = () => {
    setFormData((prev) => ({ ...prev, photo_path: '' }))
    setPreviewSrc(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.first_name.trim() || !formData.last_name.trim()) {
      alert('First Name and Last Name are required.')
      return
    }

    try {
      if (isEditMode) {
        const res = await window.api.updateStaff(id, formData)
        if (res.success) navigate(`/staff/${id}`)
      } else {
        const res = await window.api.addStaff(formData)
        if (res.success) navigate(`/staff/${res.id}`)
      }
    } catch (err) {
      console.error('Failed to save staff record:', err)
      alert('Failed to save staff record. Please try again.')
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
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 shadow-sm transition hover:bg-slate-50"
          >
            <ArrowLeft size={18} />
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Photo Upload Card */}
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-lg">
          <h2 className="mb-4 text-base font-bold text-slate-800">Staff Photo</h2>
          <div className="flex flex-col items-center gap-5 sm:flex-row">
            {/* Preview Box */}
            <div className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 overflow-hidden text-slate-400">
              {previewSrc ? (
                <>
                  <img src={previewSrc} alt="Preview" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={handleClearPhoto}
                    className="absolute right-1 top-1 rounded-full bg-slate-900/60 p-1 text-white hover:bg-slate-900 transition"
                  >
                    <X size={14} />
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center gap-1 text-center p-2">
                  <ImageIcon size={24} className="stroke-1" />
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                    No Photo
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={handleSelectPhoto}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
              >
                <Upload size={16} />
                <span>{previewSrc ? 'Change Photo' : 'Upload Photo'}</span>
              </button>
              {previewSrc && (
                <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                  <span>✓</span> Photo selected — will be saved on submit
                </p>
              )}
              <p className="text-xs text-slate-400">
                Recommended: 1:1 square. Supported: JPG, PNG, WEBP.
              </p>
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Personal Information */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-lg space-y-4">
            <h2 className="text-base font-bold text-slate-800">Personal Information</h2>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400">First Name *</label>
                <input
                  type="text"
                  name="first_name"
                  required
                  value={formData.first_name}
                  onChange={handleInputChange}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400">Last Name *</label>
                <input
                  type="text"
                  name="last_name"
                  required
                  value={formData.last_name}
                  onChange={handleInputChange}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400">Middle Name</label>
              <input
                type="text"
                name="middle_name"
                value={formData.middle_name}
                onChange={handleInputChange}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400">Gender</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleInputChange}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400">Birth Date</label>
                <input
                  type="date"
                  name="birth_date"
                  value={formData.birth_date}
                  onChange={handleInputChange}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                />
              </div>
            </div>
          </div>

          {/* Employment Details */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-lg space-y-4">
            <h2 className="text-base font-bold text-slate-800">Employment Details</h2>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400">Employee Number</label>
                <input
                  type="text"
                  name="employee_number"
                  placeholder="e.g. EMP-00123"
                  value={formData.employee_number}
                  onChange={handleInputChange}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400">Employment Status</label>
                <select
                  name="employment_status"
                  value={formData.employment_status}
                  onChange={handleInputChange}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Resigned">Resigned</option>
                  <option value="Terminated">Terminated</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400">Role / Position</label>
              <select
                name="role_id"
                value={formData.role_id}
                onChange={handleInputChange}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
              >
                <option value="">Select Role</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.role_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400">Date Hired</label>
              <input
                type="date"
                name="date_hired"
                value={formData.date_hired}
                onChange={handleInputChange}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
              />
            </div>
          </div>

          {/* Contact Details */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-lg space-y-4">
            <h2 className="text-base font-bold text-slate-800">Contact Details</h2>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400">Contact Number</label>
                <input
                  type="text"
                  name="contact_number"
                  placeholder="e.g. +63 912 345 6789"
                  value={formData.contact_number}
                  onChange={handleInputChange}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400">Email Address</label>
                <input
                  type="email"
                  name="email"
                  placeholder="e.g. user@org.com"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400">Home Address</label>
              <textarea
                name="address"
                placeholder="Complete street address, city, province"
                value={formData.address}
                onChange={handleInputChange}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                rows={2}
              />
            </div>
          </div>

          {/* Emergency Information */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-lg space-y-4">
            <h2 className="text-base font-bold text-slate-800">Emergency Contact</h2>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400">Emergency Contact Name</label>
              <input
                type="text"
                name="emergency_contact_name"
                placeholder="e.g. Jane Doe"
                value={formData.emergency_contact_name}
                onChange={handleInputChange}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400">
                Emergency Contact Number
              </label>
              <input
                type="text"
                name="emergency_contact_number"
                placeholder="e.g. +63 999 888 7777"
                value={formData.emergency_contact_number}
                onChange={handleInputChange}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition active:scale-95"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex items-center gap-2 rounded-xl bg-sky-500 px-6 py-3 text-sm font-bold text-black shadow-md hover:bg-sky-600 transition active:scale-95"
          >
            <Save size={16} />
            <span>Save Staff Record</span>
          </button>
        </div>
      </form>
    </div>
  )
}
