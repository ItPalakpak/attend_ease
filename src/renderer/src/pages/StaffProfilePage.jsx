import React, { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Edit2,
  Trash2,
  CreditCard,
  RefreshCw,
  Calendar,
  Phone,
  Mail,
  MapPin,
  User,
  ShieldAlert,
  Clock
} from 'lucide-react'
import StatusBadge from '../components/ui/StatusBadge'
import ConfirmDialog from '../components/ui/ConfirmDialog'

export default function StaffProfilePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [staff, setStaff] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  // Dialog State
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isRegenQRConfirmOpen, setIsRegenQRConfirmOpen] = useState(false)
  const [isRegeningQR, setIsRegeningQR] = useState(false)
  const [photoBase64, setPhotoBase64] = useState(null)
  const [qrBase64, setQrBase64] = useState(null)

  const fetchStaffDetails = async () => {
    try {
      const details = await window.api.getStaffById(id)
      setStaff(details)
    } catch (err) {
      console.error('Failed to fetch staff details:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchStaffDetails()
  }, [id])

  const handleDelete = async () => {
    try {
      const res = await window.api.deleteStaff(id)
      if (res.success) {
        navigate('/staff')
      }
    } catch (err) {
      console.error('Failed to delete staff:', err)
    }
  }

  const handleRegenerateQR = async () => {
    setIsRegeningQR(true)
    try {
      const res = await window.api.regenerateQRCode(id)
      if (res.success) {
        fetchStaffDetails()
      }
    } catch (err) {
      console.error('Failed to regenerate QR code:', err)
    } finally {
      setIsRegeningQR(false)
      setIsRegenQRConfirmOpen(false)
    }
  }
  useEffect(() => {
    let active = true
    const loadImages = async () => {
      if (!staff) {
        if (active) {
          setPhotoBase64(null)
          setQrBase64(null)
        }
        return
      }
      if (staff.photo_path) {
        const b64 = await window.api.readFileAsBase64(staff.photo_path)
        if (active) setPhotoBase64(b64 || null)
      } else {
        if (active) setPhotoBase64(null)
      }
      if (staff.qr_code_path) {
        const b64 = await window.api.readFileAsBase64(staff.qr_code_path)
        if (active) setQrBase64(b64 || null)
      } else {
        if (active) setQrBase64(null)
      }
    }
    loadImages()
    return () => {
      active = false
    }
  }, [staff])
  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-sky-500" />
      </div>
    )
  }

  if (!staff) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
        <ShieldAlert size={48} className="text-slate-400" />
        <h2 className="text-xl font-bold text-slate-800">Staff Record Not Found</h2>
        <p className="text-sm text-slate-500">
          The requested staff record does not exist or has been deleted.
        </p>
        <button
          onClick={() => navigate('/staff')}
          className="rounded-xl bg-sky-500 px-5 py-2 text-sm font-bold text-black transition hover:bg-sky-600"
        >
          Back to Staff List
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header / Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/staff')}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 shadow-sm transition hover:bg-slate-50"
          >
            <ArrowLeft size={18} />
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => navigate(`/staff/edit/${staff.id}`)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
          >
            <Edit2 size={16} />
            <span>Edit Profile</span>
          </button>
          <button
            onClick={() => navigate(`/id-cards/${staff.id}`)}
            className="flex items-center gap-1.5 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-bold text-black shadow-md transition hover:bg-sky-600 active:scale-95"
          >
            <CreditCard size={16} />
            <span>Generate ID Card</span>
          </button>
          <button
            onClick={() => setIsConfirmOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-100 active:scale-95"
          >
            <Trash2 size={16} />
            <span>Delete Staff</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column - Large Photo & QR Card */}
        <div className="space-y-6 lg:col-span-1">
          {/* Card Photo/QR */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-lg text-center space-y-6">
            {/* Photo */}
            <div className="relative mx-auto h-32 w-32 overflow-hidden rounded-full ring-4 ring-slate-100">
              {photoBase64 ? (
                <img
                  src={photoBase64}
                  alt={`${staff.first_name} ${staff.last_name}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-100 text-3xl font-bold text-slate-500">
                  {staff.first_name?.[0]}
                  {staff.last_name?.[0]}
                </div>
              )}
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-800">
                {staff.first_name} {staff.last_name}
              </h2>
              <p className="text-sm font-semibold text-slate-400">
                {staff.role_name || 'Unassigned Role'}
              </p>
              <div className="mt-2">
                <StatusBadge status={staff.employment_status} />
              </div>
            </div>

            <div className="border-t border-slate-100 pt-6 space-y-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Attendance QR Code
              </p>
              <div className="flex justify-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                {qrBase64 ? (
                  <img src={qrBase64} alt="QR Code" className="h-32 w-32" />
                ) : (
                  <div className="flex h-32 w-32 flex-col items-center justify-center text-slate-400">
                    <ShieldAlert size={24} />
                    <span className="text-[10px] mt-1 font-semibold uppercase tracking-wide">
                      No QR Code
                    </span>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsRegenQRConfirmOpen(true)}
                disabled={isRegeningQR}
                className="flex items-center gap-1.5 mx-auto text-xs font-semibold text-sky-600 hover:text-sky-700 transition"
              >
                <RefreshCw size={14} className={isRegeningQR ? 'animate-spin' : ''} />
                <span>Regenerate QR Code</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column - Detailed Profile Data */}
        <div className="space-y-6 lg:col-span-2">
          {/* Staff Information */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-lg space-y-6">
            <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3">
              Staff Information
            </h3>

            {/* Fields Grid */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {/* Personal */}
              <div className="space-y-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Personal Info
                </h4>
                <div className="space-y-3">
                  <div className="flex gap-3 text-sm">
                    <User size={16} className="text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-slate-500 text-xs uppercase tracking-wide">
                        Full Name
                      </p>
                      <p className="font-medium text-slate-800">
                        {staff.first_name} {staff.middle_name ? `${staff.middle_name} ` : ''}
                        {staff.last_name}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 text-sm">
                    <Calendar size={16} className="text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-slate-500 text-xs uppercase tracking-wide">
                        Birth Date & Gender
                      </p>
                      <p className="font-medium text-slate-800">
                        {staff.birth_date ? new Date(staff.birth_date).toLocaleDateString() : 'N/A'}{' '}
                        ({staff.gender || 'N/A'})
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Employment */}
              <div className="space-y-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Employment Info
                </h4>
                <div className="space-y-3">
                  <div className="flex gap-3 text-sm">
                    <Clock size={16} className="text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-slate-500 text-xs uppercase tracking-wide">
                        Staff ID & Employee No.
                      </p>
                      <p className="font-semibold text-slate-800 font-mono">
                        {staff.formatted_id || staff.staff_id} / {staff.employee_number || 'N/A'}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 text-sm">
                    <Calendar size={16} className="text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-slate-500 text-xs uppercase tracking-wide">
                        Date Hired
                      </p>
                      <p className="font-medium text-slate-800">
                        {staff.date_hired ? new Date(staff.date_hired).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact */}
              <div className="space-y-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Contact details
                </h4>
                <div className="space-y-3">
                  <div className="flex gap-3 text-sm">
                    <Phone size={16} className="text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-slate-500 text-xs uppercase tracking-wide">
                        Contact Number
                      </p>
                      <p className="font-medium text-slate-800">{staff.contact_number || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="flex gap-3 text-sm">
                    <Mail size={16} className="text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-slate-500 text-xs uppercase tracking-wide">
                        Email Address
                      </p>
                      <p className="font-medium text-slate-800">{staff.email || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="flex gap-3 text-sm">
                    <MapPin size={16} className="text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-slate-500 text-xs uppercase tracking-wide">
                        Home Address
                      </p>
                      <p className="font-medium text-slate-800 leading-relaxed">
                        {staff.address || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Emergency */}
              <div className="space-y-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Emergency Contact
                </h4>
                <div className="space-y-3">
                  <div className="flex gap-3 text-sm">
                    <User size={16} className="text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-slate-500 text-xs uppercase tracking-wide">
                        Contact Person
                      </p>
                      <p className="font-medium text-slate-800">
                        {staff.emergency_contact_name || 'N/A'}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 text-sm">
                    <Phone size={16} className="text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-slate-500 text-xs uppercase tracking-wide">
                        Emergency Number
                      </p>
                      <p className="font-medium text-slate-800">
                        {staff.emergency_contact_number || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Role Change History */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-lg">
            <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 mb-4">
              Position / Role History
            </h3>

            {!staff.role_history || staff.role_history.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">
                No role updates recorded for this staff member.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wider text-slate-400">
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Old Position</th>
                      <th className="py-2 px-3">New Position</th>
                      <th className="py-2 px-3">Performed By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-xs text-slate-600">
                    {staff.role_history.map((hist, index) => (
                      <tr key={index} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono">
                          {new Date(hist.changed_at).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {hist.old_role_name || '(Initial)'}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-700">
                          {hist.new_role_name}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-500">
                          {hist.changed_by}
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
        onConfirm={handleDelete}
        title="Delete Staff Record"
        message={`Are you sure you want to delete "${staff.first_name} ${staff.last_name}"? This action cannot be undone. All security credentials, photo files, and role histories associated with this employee will be deleted permanently.`}
        confirmText="Delete Record"
        cancelText="Cancel"
        type="danger"
      />

      {/* Confirm Regenerate QR Dialog */}
      <ConfirmDialog
        isOpen={isRegenQRConfirmOpen}
        onClose={() => setIsRegenQRConfirmOpen(false)}
        onConfirm={handleRegenerateQR}
        title="Regenerate QR Code"
        message="Are you sure you want to regenerate the QR code for this staff member? This will render the old printed QR code card invalid for scanning attendance."
        confirmText="Regenerate"
        cancelText="Cancel"
        type="info"
      />
    </div>
  )
}
