import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, Printer, CreditCard } from 'lucide-react'
import html2canvas from 'html2canvas'
import idFrontBg from '../assets/id_front.png'
import idBackBg from '../assets/id_back.png'

// ─── Layout Constants ────────────────────────────────────────────────────────
const CARD_W = 300
const CARD_H = 545

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function IDCardPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [staffList, setStaffList] = useState([])
  const [selectedStaffId, setSelectedStaffId] = useState(id || '')
  const [isCapturingFront, setIsCapturingFront] = useState(false)
  const [isCapturingBack, setIsCapturingBack] = useState(false)
  const [photoBase64, setPhotoBase64] = useState(null)
  const [qrBase64, setQrBase64] = useState(null)

  // Refs for visible preview cards (used for printing)
  const frontCardRef = useRef(null)
  const backCardRef = useRef(null)

  // Refs for off-screen cards (specifically styled/positioned for PNG export)
  const frontExportRef = useRef(null)
  const backExportRef = useRef(null)

  const staff = selectedStaffId
    ? staffList.find((s) => String(s.id) === selectedStaffId) || null
    : null

  useEffect(() => {
    const loadData = async () => {
      try {
        const list = await window.api.getStaffList()
        setStaffList(list || [])
        const activeId = id || (list.length > 0 ? String(list[0].id) : '')
        setSelectedStaffId(activeId)
      } catch (err) {
        console.error('Failed to load ID card data:', err)
      }
    }
    loadData()
  }, [id])

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
      // Ensure all custom web fonts are fully loaded prior to screenshot capture
      if (document.fonts) {
        await document.fonts.ready
      }
      await new Promise((resolve) => setTimeout(resolve, 300))
      const canvas = await html2canvas(element, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null
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
    captureCard(frontExportRef.current, `${name}_ID_Front.png`, setIsCapturingFront)
  }

  const handleDownloadBack = () => {
    if (!staff) return
    const name = `${staff.first_name}_${staff.last_name}`.replace(/\s+/g, '_')
    captureCard(backExportRef.current, `${name}_ID_Back.png`, setIsCapturingBack)
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
    const first = staff.first_name || ''
    let middle = staff.middle_name || ''
    if (middle) {
      middle = middle.trim().charAt(0).toUpperCase() + '.'
    }
    const last = staff.last_name || ''
    return [first, middle, last].filter(Boolean).join(' ')
  }

  // ─── Shared card shell style ───────────────────────────────────────────────
  const cardStyle = {
    width: `${CARD_W}px`,
    height: `${CARD_H}px`,
    minWidth: `${CARD_W}px`,
    minHeight: `${CARD_H}px`,
    maxHeight: `${CARD_H}px`,
    borderRadius: '16px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 24px 64px rgba(0,0,0,0.32)',
    position: 'relative',
    fontFamily: '"Outfit", "Inter", system-ui, -apple-system, sans-serif'
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* ── Controls Bar ── */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm print:hidden sm:flex-row sm:items-center">
        {/* Back button */}
        <button
          onClick={() => navigate('/staff')}
          className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 shadow-sm transition hover:bg-slate-50 shrink-0"
        >
          <ArrowLeft size={18} />
        </button>

        {/* Staff Selector */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
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

        {/* Action Buttons */}
        {staff && (
          <div className="flex flex-row gap-2 shrink-0">
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

      {/* ── Card Preview ── */}
      {!staff ? (
        <div className="flex flex-col items-center justify-center h-[40vh] border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 p-6 print:hidden">
          <CreditCard size={48} className="stroke-1 text-slate-300" />
          <h3 className="mt-4 text-base font-bold text-slate-700">No Staff Selected</h3>
          <p className="text-sm text-slate-400 mt-1">
            Choose an employee above to generate their ID card.
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-10 md:flex-row md:justify-center print:flex-row print:justify-center print:gap-12 animate-fade-in">
          {/* ====================================
              FRONT PREVIEW CARD (Optimized for display)
             ==================================== */}
          <div className="print:my-0">
            <h4 className="mb-3 text-center text-xs font-bold uppercase tracking-widest text-slate-400 print:hidden">
              Front Side
            </h4>
            <div ref={frontCardRef} style={cardStyle}>
              {/* Background Image */}
              <img
                src={idFrontBg}
                alt="Card Front Background"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'fill',
                  zIndex: 1
                }}
              />

              {/* Profile Photo */}
              <div
                style={{
                  position: 'absolute',
                  top: '102px',
                  left: '96px',
                  width: '108px',
                  height: '108px',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  zIndex: 10
                }}
              >
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

              {/* Data fields values (Visual Preview Coordinates) */}
              <div
                style={{
                  position: 'absolute',
                  top: '258px',
                  left: '145px',
                  fontSize:
                    getFullName().length > 25
                      ? '10px'
                      : getFullName().length > 20
                        ? '11px'
                        : '13px',
                  fontWeight: '800',
                  color: '#111111',
                  fontFamily: '"Plus Jakarta Sans", "Outfit", "Inter", sans-serif',
                  lineHeight: '1.2',
                  zIndex: 10,
                  width: '148px',
                  whiteSpace: 'normal',
                  wordWrap: 'break-word',
                  maxHeight: '34px'
                }}
              >
                {getFullName()}
              </div>

              <div
                style={{
                  position: 'absolute',
                  top: '284px',
                  left: '145px',
                  fontSize: '13px',
                  fontWeight: '800',
                  color: '#111111',
                  fontFamily: '"Plus Jakarta Sans", "Outfit", "Inter", sans-serif',
                  lineHeight: '1.2',
                  zIndex: 10
                }}
              >
                {staff.employee_number || staff.staff_id}
              </div>

              <div
                style={{
                  position: 'absolute',
                  top: '306px',
                  left: '145px',
                  fontSize: '13px',
                  fontWeight: '800',
                  color: '#111111',
                  fontFamily: '"Plus Jakarta Sans", "Outfit", "Inter", sans-serif',
                  lineHeight: '1.2',
                  zIndex: 10
                }}
              >
                {staff.department || 'Operations'}
              </div>

              <div
                style={{
                  position: 'absolute',
                  top: '330px',
                  left: '145px',
                  fontSize: '13px',
                  fontWeight: '800',
                  color: '#111111',
                  fontFamily: '"Plus Jakarta Sans", "Outfit", "Inter", sans-serif',
                  lineHeight: '1.2',
                  zIndex: 10
                }}
              >
                {getValidUntil()}
              </div>

              {/* Position Value */}
              <div
                style={{
                  position: 'absolute',
                  top: '380px',
                  left: '78px',
                  fontSize: '16px',
                  fontWeight: '900',
                  color: '#111111',
                  textTransform: 'uppercase',
                  fontFamily: '"Plus Jakarta Sans", "Outfit", "Inter", sans-serif',
                  lineHeight: '1.2',
                  zIndex: 10
                }}
              >
                {staff.role_name || 'RIDER'}
              </div>

              {/* QR Code Overlay */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '9px',
                  left: '22px',
                  width: '58px',
                  height: '58px',
                  background: 'white',
                  padding: '2px',
                  borderRadius: '0px',
                  border: '1.5px solid #111111',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 10
                }}
              >
                {qrBase64 ? (
                  <img
                    src={qrBase64}
                    alt="QR"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      background: '#111111',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '7px',
                      color: 'white',
                      fontWeight: 'bold'
                    }}
                  >
                    QR
                  </div>
                )}
              </div>

              {/* Footer details */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '39px',
                  left: '168px',
                  fontSize: '11px',
                  fontWeight: '900',
                  color: '#111111',
                  fontFamily: '"Plus Jakarta Sans", "Outfit", "Inter", sans-serif',
                  letterSpacing: '0.04em',
                  zIndex: 10
                }}
              >
                {staff.employee_number || staff.staff_id}
              </div>

              <div
                style={{
                  position: 'absolute',
                  bottom: '26px',
                  left: '138px',
                  fontSize: '9px',
                  fontWeight: '800',
                  color: '#111111',
                  fontFamily: '"Plus Jakarta Sans", "Outfit", "Inter", sans-serif',
                  zIndex: 10
                }}
              >
                Claveria (MO)002
              </div>

              <div
                style={{
                  position: 'absolute',
                  bottom: '11px',
                  right: '18px',
                  fontSize: '9px',
                  fontWeight: '800',
                  color: '#111111',
                  fontFamily: '"Plus Jakarta Sans", "Outfit", "Inter", sans-serif',
                  textAlign: 'right',
                  zIndex: 10
                }}
              >
                Claveria (MO)002 | {getIssuedDate()}
              </div>
            </div>
          </div>

          {/* ====================================
              BACK PREVIEW CARD (Optimized for display)
             ==================================== */}
          <div className="print:my-0">
            <h4 className="mb-3 text-center text-xs font-bold uppercase tracking-widest text-slate-400 print:hidden">
              Back Side
            </h4>
            <div ref={backCardRef} style={cardStyle}>
              {/* Background Image */}
              <img
                src={idBackBg}
                alt="Card Back Background"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'fill',
                  zIndex: 1
                }}
              />

              {/* QR Code Overlay (bottom right) */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '38px',
                  right: '19px',
                  width: '78px',
                  height: '78px',
                  background: 'white',
                  padding: '2px',
                  borderRadius: '0px',
                  border: '1.5px solid #111111',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 10
                }}
              >
                {qrBase64 ? (
                  <img
                    src={qrBase64}
                    alt="QR"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      background: '#111111',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '6px',
                      color: 'white',
                      fontWeight: 'bold'
                    }}
                  >
                    QR
                  </div>
                )}
              </div>

              {/* Human Resources | Verified | Date Issued bottom right */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '11px',
                  right: '23px',
                  fontSize: '9px',
                  fontWeight: '800',
                  color: '#111111',
                  fontFamily: '"Plus Jakarta Sans", "Outfit", "Inter", sans-serif',
                  textAlign: 'right',
                  zIndex: 10
                }}
              >
                Claveria (MO)002 | Verified | {getIssuedDate()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================
          OFF-SCREEN EXPORT CARDS (Optimized for html2canvas)
         =================================================== */}
      {staff && (
        <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', zIndex: -100 }}>
          {/* Front Export Card */}
          <div ref={frontExportRef} style={cardStyle}>
            <img
              src={idFrontBg}
              alt="Export Card Front Background"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'fill',
                zIndex: 1
              }}
            />

            {/* Profile Photo */}
            <div
              style={{
                position: 'absolute',
                top: '102px',
                left: '96px',
                width: '108px',
                height: '108px',
                borderRadius: '50%',
                overflow: 'hidden',
                zIndex: 10
              }}
            >
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

            {/* Data fields values (Export coordinates shifted up to align perfectly with the background) */}
            <div
              style={{
                position: 'absolute',
                top: '254px',
                left: '145px',
                fontSize:
                  getFullName().length > 25 ? '10px' : getFullName().length > 20 ? '11px' : '13px',
                fontWeight: '800',
                color: '#111111',
                fontFamily: '"Plus Jakarta Sans", "Outfit", "Inter", sans-serif',
                lineHeight: '1.1',
                zIndex: 10,
                width: '148px',
                whiteSpace: 'normal',
                wordWrap: 'break-word',
                maxHeight: '34px'
              }}
            >
              {getFullName()}
            </div>

            <div
              style={{
                position: 'absolute',
                top: '277px',
                left: '145px',
                fontSize: '13px',
                fontWeight: '800',
                color: '#111111',
                fontFamily: '"Plus Jakarta Sans", "Outfit", "Inter", sans-serif',
                lineHeight: '1.2',
                zIndex: 10
              }}
            >
              {staff.employee_number || staff.staff_id}
            </div>

            <div
              style={{
                position: 'absolute',
                top: '299px',
                left: '145px',
                fontSize: '13px',
                fontWeight: '800',
                color: '#111111',
                fontFamily: '"Plus Jakarta Sans", "Outfit", "Inter", sans-serif',
                lineHeight: '1.2',
                zIndex: 10
              }}
            >
              {staff.department || 'Operations'}
            </div>

            <div
              style={{
                position: 'absolute',
                top: '322px',
                left: '145px',
                fontSize: '13px',
                fontWeight: '800',
                color: '#111111',
                fontFamily: '"Plus Jakarta Sans", "Outfit", "Inter", sans-serif',
                lineHeight: '1.2',
                zIndex: 10
              }}
            >
              {getValidUntil()}
            </div>

            {/* Position Value */}
            <div
              style={{
                position: 'absolute',
                top: '373px',
                left: '78px',
                fontSize: '16px',
                fontWeight: '900',
                color: '#111111',
                textTransform: 'uppercase',
                fontFamily: '"Plus Jakarta Sans", "Outfit", "Inter", sans-serif',
                lineHeight: '1.2',
                zIndex: 10
              }}
            >
              {staff.role_name || 'RIDER'}
            </div>

            {/* QR Code Overlay */}
            <div
              style={{
                position: 'absolute',
                bottom: '9px',
                left: '22px',
                width: '58px',
                height: '58px',
                background: 'white',
                padding: '2px',
                borderRadius: '0px',
                border: '1.5px solid #111111',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10
              }}
            >
              {qrBase64 ? (
                <img
                  src={qrBase64}
                  alt="QR"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    background: '#111111',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '7px',
                    color: 'white',
                    fontWeight: 'bold'
                  }}
                >
                  QR
                </div>
              )}
            </div>

            {/* Footer details */}
            <div
              style={{
                position: 'absolute',
                bottom: '45px',
                left: '168px',
                fontSize: '11px',
                fontWeight: '900',
                color: '#111111',
                fontFamily: '"Plus Jakarta Sans", "Outfit", "Inter", sans-serif',
                letterSpacing: '0.04em',
                zIndex: 10
              }}
            >
              {staff.employee_number || staff.staff_id}
            </div>

            <div
              style={{
                position: 'absolute',
                bottom: '31px',
                left: '138px',
                fontSize: '9px',
                fontWeight: '800',
                color: '#111111',
                fontFamily: '"Plus Jakarta Sans", "Outfit", "Inter", sans-serif',
                zIndex: 10
              }}
            >
              Claveria (MO)002
            </div>

            <div
              style={{
                position: 'absolute',
                bottom: '18px',
                right: '18px',
                fontSize: '9px',
                fontWeight: '800',
                color: '#111111',
                fontFamily: '"Plus Jakarta Sans", "Outfit", "Inter", sans-serif',
                textAlign: 'right',
                zIndex: 10
              }}
            >
              Claveria (MO)002 | {getIssuedDate()}
            </div>
          </div>

          {/* Back Export Card */}
          <div ref={backExportRef} style={cardStyle}>
            <img
              src={idBackBg}
              alt="Export Card Back Background"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'fill',
                zIndex: 1
              }}
            />

            {/* QR Code Overlay (bottom right) */}
            <div
              style={{
                position: 'absolute',
                bottom: '38px',
                right: '19px',
                width: '78px',
                height: '78px',
                background: 'white',
                padding: '2px',
                borderRadius: '0px',
                border: '1.5px solid #111111',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10
              }}
            >
              {qrBase64 ? (
                <img
                  src={qrBase64}
                  alt="QR"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    background: '#111111',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '6px',
                    color: 'white',
                    fontWeight: 'bold'
                  }}
                >
                  QR
                </div>
              )}
            </div>

            {/* Human Resources | Verified | Date Issued bottom right */}
            <div
              style={{
                position: 'absolute',
                bottom: '11px',
                right: '23px',
                fontSize: '9px',
                fontWeight: '800',
                color: '#111111',
                fontFamily: '"Plus Jakarta Sans", "Outfit", "Inter", sans-serif',
                textAlign: 'right',
                zIndex: 10
              }}
            >
              Claveria (MO)002 | Verified | {getIssuedDate()}
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
          div[style*="300px"] {
            visibility: visible !important;
            page-break-inside: avoid;
            margin: 10px auto !important;
            box-shadow: none !important;
          }
          div[style*="300px"] * { visibility: visible !important; }
        }
      `}</style>
    </div>
  )
}
