import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, Printer, CreditCard } from 'lucide-react'
import html2canvas from 'html2canvas'

// ─── Barcode Component ──────────────────────────────────────────────────────────
function PseudoBarcode({ value }) {
  const seed = value || 'FE0001'
  const lines = []
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash)
  }
  for (let i = 0; i < 72; i++) {
    const isSpace = ((hash >> (i % 32)) & 1) === 0
    const width = (Math.abs(hash) >> (i % 24)) & 2
    lines.push(
      <div key={i} style={{ width: `${width + 1}px`, height: '48px', background: isSpace ? 'white' : 'black', flexShrink: 0 }} />
    )
  }
  return (
    <div style={{ background: 'white', padding: '8px 14px 6px', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', borderRadius: '4px' }}>
      <div style={{ display: 'flex', overflow: 'hidden' }}>{lines}</div>
      <span style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 900, marginTop: '4px', letterSpacing: '0.22em', color: 'black' }}>{seed}</span>
    </div>
  )
}

// ─── Card Header — thick black bar with wide diagonal stripes ───────────────────
// Matches reference: two wide yellow/amber diagonal bands on each side
function IDCardHeader() {
  return (
    <div style={{
      position: 'relative', background: 'black',
      height: '80px', overflow: 'hidden', flexShrink: 0,
      borderRadius: '16px 16px 0 0',
    }}>
      {/* LEFT — two wide diagonal bands */}
      <div style={{
        position: 'absolute', top: '-80%', left: '-18px',
        width: '46px', height: '340%',
        background: '#e6a800',
        transform: 'skewX(-14deg)',
      }} />
      <div style={{
        position: 'absolute', top: '-80%', left: '34px',
        width: '20px', height: '340%',
        background: '#ffe600',
        transform: 'skewX(-14deg)',
        opacity: 0.55,
      }} />
      {/* RIGHT — two wide diagonal bands */}
      <div style={{
        position: 'absolute', top: '-80%', right: '-18px',
        width: '46px', height: '340%',
        background: '#e6a800',
        transform: 'skewX(-14deg)',
      }} />
      <div style={{
        position: 'absolute', top: '-80%', right: '34px',
        width: '20px', height: '340%',
        background: '#ffe600',
        transform: 'skewX(-14deg)',
        opacity: 0.55,
      }} />
      {/* Brand text */}
      <div style={{
        position: 'relative', zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', gap: '8px',
      }}>
        <span style={{
          fontWeight: 900, color: 'white', fontSize: '22px',
          letterSpacing: '0.16em', fontFamily: 'system-ui, sans-serif',
        }}>FLASH</span>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="#ffe600" stroke="none">
          <polygon points="13,2 4,14 11,14 11,22 20,10 13,10" />
        </svg>
        <span style={{
          fontWeight: 900, color: 'white', fontSize: '22px',
          letterSpacing: '0.16em', fontFamily: 'system-ui, sans-serif',
        }}>EXPRESS</span>
      </div>
    </div>
  )
}

// ─── Diagonal deco stripe ────────────────────────────────────────────────────────
function DiagStripe({ style }) {
  return (
    <div style={{
      position: 'absolute',
      background: '#c8900a',
      opacity: 0.22,
      borderRadius: '1px',
      pointerEvents: 'none',
      ...style,
    }} />
  )
}

// ─── Small diamond accent ────────────────────────────────────────────────────────
function Diamond({ style }) {
  return (
    <div style={{
      position: 'absolute',
      background: 'black',
      opacity: 0.16,
      transform: 'rotate(45deg)',
      pointerEvents: 'none',
      ...style,
    }} />
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────────
export default function IDCardPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [staffList, setStaffList] = useState([])
  const [selectedStaffId, setSelectedStaffId] = useState(id || '')
  const [staff, setStaff] = useState(null)
  const [settings, setSettings] = useState({ org_name: 'Flash Express', org_address: 'Manila, Philippines' })
  const [isLoading, setIsLoading] = useState(true)
  const [isCapturingFront, setIsCapturingFront] = useState(false)
  const [isCapturingBack, setIsCapturingBack] = useState(false)
  const [photoBase64, setPhotoBase64] = useState(null)
  const [qrBase64, setQrBase64] = useState(null)
  const frontCardRef = useRef(null)
  const backCardRef = useRef(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        const list = await window.api.getStaffList()
        const appSettings = await window.api.getSettings()
        setStaffList(list || [])
        if (appSettings) setSettings(appSettings)
        const activeId = id || (list.length > 0 ? String(list[0].id) : '')
        setSelectedStaffId(activeId)
      } catch (err) {
        console.error('Failed to load ID card data:', err)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [id])

  useEffect(() => {
    if (selectedStaffId) {
      const found = staffList.find((s) => String(s.id) === selectedStaffId)
      setStaff(found || null)
    } else {
      setStaff(null)
    }
  }, [selectedStaffId, staffList])

  useEffect(() => {
    setPhotoBase64(null)
    setQrBase64(null)
    if (!staff) return
    const loadImages = async () => {
      if (staff.photo_path) {
        const b64 = await window.api.readFileAsBase64(staff.photo_path)
        setPhotoBase64(b64 || null)
      }
      if (staff.qr_code_path) {
        const b64 = await window.api.readFileAsBase64(staff.qr_code_path)
        setQrBase64(b64 || null)
      }
    }
    loadImages()
  }, [staff])

  const handleStaffChange = (e) => {
    const newId = e.target.value
    setSelectedStaffId(newId)
    if (newId) navigate(`/id-cards/${newId}`, { replace: true })
    else navigate('/id-cards', { replace: true })
  }

  const captureCard = async (element, filename, setLoader) => {
    if (!element) return
    setLoader(true)
    try {
      await new Promise((resolve) => setTimeout(resolve, 300))
      const canvas = await html2canvas(element, {
        scale: 3, useCORS: true, allowTaint: true, backgroundColor: null,
      })
      const dataUrl = canvas.toDataURL('image/png')
      const link = document.createElement('a')
      link.download = filename
      link.href = dataUrl
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      console.error('Error generating PNG:', err)
      alert('Failed to generate card image.')
    } finally {
      setLoader(false)
    }
  }

  const handleDownloadFront = () => {
    if (!staff) return
    const name = `${staff.first_name}_${staff.last_name}`.replace(/\s+/g, '_')
    captureCard(frontCardRef.current, `${name}_ID_Front.png`, setIsCapturingFront)
  }

  const handleDownloadBack = () => {
    if (!staff) return
    const name = `${staff.first_name}_${staff.last_name}`.replace(/\s+/g, '_')
    captureCard(backCardRef.current, `${name}_ID_Back.png`, setIsCapturingBack)
  }

  const handlePrint = () => window.print()

  const getValidUntil = () => {
    const year = new Date().getFullYear() + 1
    return `31 DEC ${year}`
  }

  const getIssuedDate = () => {
    const now = new Date()
    const dd = String(now.getDate()).padStart(2, '0')
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    return `${dd}-${mm}-${now.getFullYear()}`
  }

  const getFullName = () => {
    if (!staff) return ''
    return [staff.first_name, staff.middle_name, staff.last_name].filter(Boolean).join(' ')
  }

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-yellow-400" />
      </div>
    )
  }

  const CARD_W = 300
  const CARD_H = 545

  return (
    <div className="mx-auto max-w-5xl space-y-6">

      {/* ── Page Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between print:hidden">

        {/* Left: back + title */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/staff')}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 shadow-sm transition hover:bg-slate-50 shrink-0"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Generate ID Card</h1>
            <p className="text-sm text-slate-500">Design and download official Flash Express employee IDs</p>
          </div>
        </div>

        {/* Right: vertical CTA stack */}
        {staff && (
          <div className="flex flex-row gap-2 flex-wrap">
            <button
              onClick={handleDownloadFront}
              disabled={isCapturingFront}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95 disabled:opacity-50"
            >
              <Download size={15} />
              <span>{isCapturingFront ? 'Generating…' : 'Download Front'}</span>
            </button>
            <button
              onClick={handleDownloadBack}
              disabled={isCapturingBack}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95 disabled:opacity-50"
            >
              <Download size={15} />
              <span>{isCapturingBack ? 'Generating…' : 'Download Back'}</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center justify-center gap-2 rounded-xl bg-yellow-400 px-4 py-2.5 text-sm font-bold text-black shadow-md transition hover:bg-yellow-500 active:scale-95"
            >
              <Printer size={15} />
              <span>Print Card</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Staff Selector ── */}
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm print:hidden">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="text-sm font-bold text-slate-700 shrink-0">Select Employee:</label>
          <select
            value={selectedStaffId}
            onChange={handleStaffChange}
            className="w-full flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/30"
          >
            <option value="">-- Choose Staff Member --</option>
            {staffList.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.first_name} {s.last_name} ({s.employee_number || s.staff_id})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Card Preview ── */}
      {!staff ? (
        <div className="flex flex-col items-center justify-center h-[40vh] border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 p-6 print:hidden">
          <CreditCard size={48} className="stroke-1 text-slate-300" />
          <h3 className="mt-4 text-base font-bold text-slate-700">No Staff Selected</h3>
          <p className="text-sm text-slate-400 mt-1">Choose an employee above to generate their ID card.</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-10 md:flex-row md:justify-center print:flex-row print:justify-center print:gap-12">

          {/* ════════════════════════════════════════
              FRONT CARD
          ════════════════════════════════════════ */}
          <div className="print:my-0">
            <h4 className="mb-3 text-center text-xs font-bold uppercase tracking-widest text-slate-400 print:hidden">Front Side</h4>
            <div
              ref={frontCardRef}
              style={{
                width: `${CARD_W}px`, height: `${CARD_H}px`,
                minWidth: `${CARD_W}px`, minHeight: `${CARD_H}px`,
                background: '#ffe600',
                borderRadius: '16px', overflow: 'hidden',
                display: 'flex', flexDirection: 'column',
                boxShadow: '0 24px 64px rgba(0,0,0,0.32)',
                position: 'relative',
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
            >
              <IDCardHeader />

              {/* Yellow body */}
              <div style={{ position: 'relative', flex: 1, background: '#ffe600', display: 'flex', flexDirection: 'column' }}>

                {/* ── Diagonal body decorations (top-right cluster) ── */}
                <DiagStripe style={{ width: '12px', height: '80px', transform: 'rotate(-38deg)', top: '-22px', right: '10px' }} />
                <DiagStripe style={{ width: '7px', height: '60px', transform: 'rotate(-38deg)', top: '-12px', right: '26px' }} />
                <DiagStripe style={{ width: '4px', height: '44px', transform: 'rotate(-38deg)', top: '-16px', right: '38px' }} />
                <Diamond style={{ width: '8px', height: '8px', top: '36px', right: '58px' }} />
                <Diamond style={{ width: '5px', height: '5px', top: '14px', right: '6px' }} />

                {/* ── Diagonal body decorations (bottom-left cluster) ── */}
                <DiagStripe style={{ width: '12px', height: '80px', transform: 'rotate(-38deg)', bottom: '138px', left: '-8px' }} />
                <DiagStripe style={{ width: '7px', height: '60px', transform: 'rotate(-38deg)', bottom: '122px', left: '8px' }} />
                <Diamond style={{ width: '7px', height: '7px', bottom: '160px', left: '24px' }} />

                {/* ── Content ── */}
                <div style={{
                  flex: 1, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', padding: '12px 22px 6px', gap: '0',
                }}>

                  {/* Photo circle */}
                  <div style={{
                    width: '100px', height: '100px', borderRadius: '50%',
                    border: '4px solid black',
                    overflow: 'hidden', background: '#bbb',
                    flexShrink: 0, position: 'relative',
                  }}>
                    {photoBase64 ? (
                      <img
                        src={photoBase64}
                        alt={staff.first_name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }} fill="#888">
                        <circle cx="50" cy="36" r="22" />
                        <ellipse cx="50" cy="92" rx="35" ry="26" />
                      </svg>
                    )}
                  </div>

                  {/* EMPLOYEE ID CARD label */}
                  <p style={{
                    marginTop: '8px',
                    fontWeight: 900, fontSize: '13px',
                    letterSpacing: '0.18em', color: 'black',
                    textTransform: 'uppercase',
                  }}>
                    EMPLOYEE ID CARD
                  </p>

                  {/* Detail rows */}
                  <div style={{ width: '100%', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {[
                      { label: 'FULL NAME', value: getFullName() },
                      { label: 'EMPLOYEE ID', value: staff.employee_number || staff.staff_id },
                      { label: 'DEPARTMENT', value: staff.department || 'Operations' },
                      { label: 'VALID UNTIL', value: getValidUntil() },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                        <span style={{
                          fontWeight: 900, fontSize: '8.5px', letterSpacing: '0.1em',
                          color: '#1a1a1a', textTransform: 'uppercase',
                          minWidth: '82px', flexShrink: 0,
                        }}>
                          {label}:
                        </span>
                        <span style={{ fontWeight: 700, fontSize: '11px', color: 'black' }}>
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Position — label + icon + value all on one row */}
                  <div style={{ width: '100%', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <span style={{
                      fontWeight: 900, fontSize: '9px',
                      letterSpacing: '0.14em', color: 'black',
                      textTransform: 'uppercase', flexShrink: 0,
                    }}>
                      POSITION:
                    </span>
                    <div style={{
                      width: '22px', height: '22px', borderRadius: '50%',
                      background: 'black',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="#ffe600" stroke="none">
                        <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                      </svg>
                    </div>
                    <p style={{
                      fontWeight: 900, fontSize: '14px', color: 'black',
                      textTransform: 'uppercase', lineHeight: '1.15', margin: 0,
                    }}>
                      {staff.role_name || 'STAFF'}
                    </p>
                  </div>
                </div>

                {/* ── Black footer bar ── */}
                <div style={{
                  background: 'black', padding: '9px 16px',
                  display: 'flex', alignItems: 'center', flexShrink: 0,
                }}>
                  <div>
                    <p style={{
                      fontWeight: 900, color: 'white', fontSize: '12px',
                      letterSpacing: '0.18em', textTransform: 'uppercase', margin: 0,
                    }}>
                      {settings.org_name || 'FLASH EXPRESS'}
                    </p>
                    <p style={{
                      fontWeight: 700, color: '#ffe600', fontSize: '7px',
                      letterSpacing: '0.24em', textTransform: 'uppercase', margin: 0,
                    }}>
                      EMPOWERING SERVICE
                    </p>
                  </div>
                </div>

                {/* ── White bottom info strip ── */}
                <div style={{
                  background: 'white',
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '7px 10px', flexShrink: 0,
                }}>
                  {/* QR Code */}
                  <div style={{ width: '54px', height: '54px', flexShrink: 0 }}>
                    {qrBase64 ? (
                      <img src={qrBase64} alt="QR" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '7px', color: 'white', fontWeight: 700 }}>QR</div>
                    )}
                  </div>
                  {/* Employee code block */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '7px', color: '#64748b', fontWeight: 600, margin: '0 0 1px', whiteSpace: 'nowrap' }}>Employee Code:</p>
                    <p style={{ fontSize: '11px', color: 'black', fontWeight: 900, margin: '0 0 3px', fontFamily: 'monospace', letterSpacing: '0.04em' }}>
                      {staff.employee_number || staff.staff_id}
                    </p>
                    <p style={{ fontSize: '5.5px', color: '#94a3b8', fontWeight: 600, margin: 0 }}>
                      Issued By: Human Resources | {getIssuedDate()}
                    </p>
                  </div>
                  {/* Contact info — right-aligned column */}
                  <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
                    {[
                      {
                        svg: <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.82a16 16 0 0 0 6.29 6.29l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>,
                        text: staff.contact_number || 'N/A',
                      },
                      {
                        svg: <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>,
                        text: staff.email || 'hr@flashexpress.ph',
                      },
                    ].map(({ svg, text }, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        {svg}
                        <span style={{ fontSize: '6.5px', color: '#475569', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ════════════════════════════════════════
              BACK CARD
          ════════════════════════════════════════ */}
          <div className="print:my-0">
            <h4 className="mb-3 text-center text-xs font-bold uppercase tracking-widest text-slate-400 print:hidden">Back Side</h4>
            <div
              ref={backCardRef}
              style={{
                width: `${CARD_W}px`, height: `${CARD_H}px`,
                minWidth: `${CARD_W}px`, minHeight: `${CARD_H}px`,
                background: '#ffe600',
                borderRadius: '16px', overflow: 'hidden',
                display: 'flex', flexDirection: 'column',
                boxShadow: '0 24px 64px rgba(0,0,0,0.32)',
                position: 'relative',
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
            >
              <IDCardHeader />

              {/* Yellow body */}
              <div style={{ position: 'relative', flex: 1, background: '#ffe600', display: 'flex', flexDirection: 'column' }}>

                {/* Deco top-right */}
                <DiagStripe style={{ width: '12px', height: '80px', transform: 'rotate(-38deg)', top: '-22px', right: '10px' }} />
                <DiagStripe style={{ width: '7px', height: '60px', transform: 'rotate(-38deg)', top: '-12px', right: '26px' }} />
                <DiagStripe style={{ width: '4px', height: '44px', transform: 'rotate(-38deg)', top: '-16px', right: '38px' }} />
                <Diamond style={{ width: '8px', height: '8px', top: '36px', right: '58px' }} />
                <Diamond style={{ width: '5px', height: '5px', top: '14px', right: '6px' }} />

                {/* Deco bottom-left */}
                <DiagStripe style={{ width: '12px', height: '80px', transform: 'rotate(-38deg)', bottom: '138px', left: '-8px' }} />
                <DiagStripe style={{ width: '7px', height: '60px', transform: 'rotate(-38deg)', bottom: '122px', left: '8px' }} />
                <Diamond style={{ width: '7px', height: '7px', bottom: '160px', left: '24px' }} />

                {/* Content */}
                <div style={{
                  flex: 1, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', padding: '14px 22px 8px',
                }}>

                  {/* FLASH ⚡ H logo — big, centered */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <span style={{
                      fontWeight: 900, fontSize: '28px', color: 'black',
                      letterSpacing: '-0.01em',
                    }}>FLA</span>
                    <svg width="26" height="32" viewBox="0 0 24 24" fill="black" stroke="none">
                      <polygon points="13,2 4,14 11,14 11,22 20,10 13,10" />
                    </svg>
                    <span style={{
                      fontWeight: 900, fontSize: '28px', color: 'black',
                      letterSpacing: '-0.01em',
                    }}>H</span>
                  </div>
                  <p style={{
                    fontWeight: 900, fontSize: '9px', color: 'black',
                    letterSpacing: '0.36em', textTransform: 'uppercase',
                    margin: '3px 0 0',
                  }}>EXPRESS</p>

                  {/* Divider */}
                  <div style={{
                    width: '88%', height: '1.5px',
                    background: 'rgba(0,0,0,0.18)',
                    margin: '16px 0 12px',
                  }} />

                  {/* Instructions header */}
                  <p style={{
                    fontWeight: 900, fontSize: '11px',
                    letterSpacing: '0.14em', textTransform: 'uppercase',
                    color: 'black', marginBottom: '14px',
                  }}>
                    CARDHOLDER INSTRUCTIONS
                  </p>

                  {/* Instructions list */}
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '11px' }}>
                    {[
                      { icon: '💳', text: 'This card remains the property of FLASH EXPRESS.' },
                      { icon: '✋', text: 'Display this card while on duty.' },
                      {
                        icon: '⚠️',
                        text: `If found, please return to any FLASH EXPRESS branch or mail to: Human Resources, ${settings.org_address || 'Manila, Philippines'}.`,
                      },
                      { icon: '🔒', text: 'Do not alter, deface, or reproduce.' },
                    ].map(({ icon, text }, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        <span style={{ fontSize: '15px', flexShrink: 0, lineHeight: '1.2' }}>{icon}</span>
                        <p style={{
                          fontSize: '9px', fontWeight: 600, color: 'black',
                          margin: 0, lineHeight: '1.55',
                        }}>{text}</p>
                      </div>
                    ))}
                  </div>

                  {/* Barcode */}
                  <div style={{ marginTop: '18px', width: '100%', display: 'flex', justifyContent: 'center' }}>
                    <PseudoBarcode value={staff.employee_number || staff.staff_id} />
                  </div>
                </div>

                {/* Black footer bar — org name left, QR right (matches reference) */}
                <div style={{
                  background: 'black', padding: '10px 14px',
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', flexShrink: 0,
                }}>
                  <div>
                    <p style={{
                      fontWeight: 900, color: 'white', fontSize: '12px',
                      letterSpacing: '0.18em', textTransform: 'uppercase', margin: 0,
                    }}>
                      {settings.org_name || 'FLASH EXPRESS'}
                    </p>
                    <p style={{
                      fontWeight: 700, color: '#ffe600', fontSize: '7px',
                      letterSpacing: '0.24em', textTransform: 'uppercase', margin: 0,
                    }}>
                      EMPOWERING SERVICE
                    </p>
                  </div>
                  {/* QR on right side of black bar */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                    <div style={{ width: '52px', height: '52px', background: 'white', padding: '2px', borderRadius: '3px' }}>
                      {qrBase64 ? (
                        <img src={qrBase64} alt="QR" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '6px', color: 'white', fontWeight: 700 }}>QR</div>
                      )}
                    </div>
                    <p style={{ fontSize: '5.5px', color: '#9ca3af', fontWeight: 600, margin: 0, textAlign: 'center' }}>Scan for Verification</p>
                  </div>
                </div>

                {/* Slim white caption strip */}
                <div style={{
                  background: 'white', padding: '5px 14px', flexShrink: 0,
                }}>
                  <p style={{ fontSize: '6.5px', fontWeight: 700, color: '#374151', margin: 0 }}>
                    Human Resources | Verified | {getIssuedDate()}
                  </p>
                  <p style={{ fontSize: '6px', color: '#94a3b8', fontWeight: 500, margin: '1px 0 0' }}>
                    Scan QR code for identity verification
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print CSS */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #root { background: none !important; }
          .print\\:hidden { display: none !important; }
          div[style*="500px"] {
            visibility: visible !important;
            page-break-inside: avoid;
            margin: 10px auto !important;
            box-shadow: none !important;
          }
          div[style*="500px"] * { visibility: visible !important; }
        }
      `}</style>
    </div>
  )
}