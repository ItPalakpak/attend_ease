export default function StatusBadge({ status }) {
  if (!status) return null
  const cleanStatus = String(status || '').trim()

  let badgeStyles = 'bg-slate-100 text-slate-700 border-slate-200'

  if (['Active', 'Present', 'Delivered'].includes(cleanStatus)) {
    badgeStyles = 'bg-emerald-50 text-emerald-700 border-emerald-100'
  } else if (['Late', 'Pending'].includes(cleanStatus)) {
    badgeStyles = 'bg-amber-50 text-amber-700 border-amber-100'
  } else if (['Inactive', 'Absent', 'Terminated', 'Returned'].includes(cleanStatus)) {
    badgeStyles = 'bg-rose-50 text-rose-700 border-rose-100'
  } else if (['Resigned', 'Off-duty', 'Off'].includes(cleanStatus)) {
    badgeStyles = 'bg-slate-50 text-slate-650 border-slate-200 text-slate-500'
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${badgeStyles}`}
    >
      {cleanStatus}
    </span>
  )
}
