import React, { useState, useEffect, useRef, useCallback } from 'react'
import { ScanLine, CheckCircle2, AlertTriangle, Clock, Camera, CameraOff, Info } from 'lucide-react'
import { Html5Qrcode } from 'html5-qrcode'

export default function AttendanceScanPage() {
  const [scanMode, setScanMode] = useState('in') // 'in' or 'out'
  const [now, setNow] = useState(new Date())
  const [isScanning, setIsScanning] = useState(false)
  const [scanResult, setScanResult] = useState(null)
  const [warnResult, setWarnResult] = useState(null) // for "already scanned" warning
  const [errorMsg, setErrorMsg] = useState('')

  // Refs to avoid stale closures and prevent duplicate scanners
  const scannerRef = useRef(null)
  const isRunningRef = useRef(false)
  const cooldownRef = useRef(false)
  const scanModeRef = useRef(scanMode)
  const resultTimerRef = useRef(null)

  // Keep scanModeRef in sync so the decode callback always reads current mode
  useEffect(() => {
    scanModeRef.current = scanMode
  }, [scanMode])

  // Clock ticking
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Cleanup on unmount only
  useEffect(() => {
    return () => {
      if (resultTimerRef.current) clearTimeout(resultTimerRef.current)
      if (scannerRef.current && isRunningRef.current) {
        scannerRef.current.stop().catch(() => {})
      }
    }
  }, [])

  // Speak a message using the Web Speech API
  const speak = useCallback((text) => {
    try {
      window.speechSynthesis.cancel() // stop any current speech
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 0.95
      utterance.pitch = 1.0
      utterance.volume = 1.0
      utterance.lang = 'en-US'
      window.speechSynthesis.speak(utterance)
    } catch (e) {
      console.warn('Speech synthesis not available:', e)
    }
  }, [])

  // Handle decoded QR — uses refs so it never goes stale
  const handleDecode = useCallback(
    async (decodedText) => {
      // Prevent processing while cooldown is active (showing result)
      if (cooldownRef.current) return
      cooldownRef.current = true

      setErrorMsg('')
      setScanResult(null)
      setWarnResult(null)

      try {
        let scannedData
        try {
          scannedData = JSON.parse(decodedText)
        } catch (e) {
          // Fallback: assume the whole string is the raw staffId
          scannedData = { id: decodedText.trim() }
        }

        const staffId = scannedData.id || scannedData.staffId || decodedText.trim()

        if (!staffId) {
          throw new Error('Invalid QR Code format. No employee ID found.')
        }

        const d = new Date()
        const dateStr = d.toISOString().split('T')[0]
        const timeStr = d.toTimeString().split(' ')[0] // HH:MM:SS

        let res
        if (scanModeRef.current === 'in') {
          res = await window.api.clockIn({ staffId, dateStr, timeStr })
        } else {
          res = await window.api.clockOut({ staffId, dateStr, timeStr })
        }

        if (res.success) {
          // Determine voice message based on mode and status
          const status = res.attendance?.status
          if (scanModeRef.current === 'in') {
            if (status === 'Late') {
              speak('You are late')
            } else {
              speak('Good day, you are checked in')
            }
          } else {
            speak('Have a great evening')
          }

          setScanResult({
            success: true,
            message: res.message,
            staff: res.staff,
            attendance: res.attendance
          })

          // Auto-clear result after 4 seconds, then allow next scan
          if (resultTimerRef.current) clearTimeout(resultTimerRef.current)
          resultTimerRef.current = setTimeout(() => {
            setScanResult(null)
            cooldownRef.current = false
          }, 4000)
        } else if (res.alreadyRecorded) {
          // Already clocked in/out — show as warning, NOT error
          speak('Scan already processed')

          setWarnResult({
            message: res.message,
            attendance: res.attendance
          })

          if (resultTimerRef.current) clearTimeout(resultTimerRef.current)
          resultTimerRef.current = setTimeout(() => {
            setWarnResult(null)
            cooldownRef.current = false
          }, 4000)
        } else {
          throw new Error(res.message || 'Operation failed')
        }
      } catch (err) {
        console.error(err)
        setErrorMsg(err.message || 'Verification failed')
        cooldownRef.current = false
      }
    },
    [speak]
  )

  // Start scanning — opens the camera
  const startScanning = useCallback(async () => {
    // Guard: prevent starting if already running
    if (isRunningRef.current) return

    const qrReaderEl = document.getElementById('qr-reader')
    if (!qrReaderEl) return

    setErrorMsg('')
    setScanResult(null)
    setWarnResult(null)
    cooldownRef.current = false

    try {
      // Get available cameras
      const cameras = await Html5Qrcode.getCameras()
      if (!cameras || cameras.length === 0) {
        throw new Error('No camera found. Please connect a camera and try again.')
      }

      const scanner = new Html5Qrcode('qr-reader')
      scannerRef.current = scanner

      await scanner.start(
        cameras[0].id, // Use the first available camera
        {
          fps: 10,
          qrbox: { width: 220, height: 220 }
        },
        handleDecode,
        () => {
          // Silent scan errors (no QR in frame) — ignore
        }
      )

      isRunningRef.current = true
      setIsScanning(true)
    } catch (err) {
      console.error('Failed to start scanner:', err)
      setErrorMsg(err.message || 'Could not start camera. Please check permissions and try again.')
      isRunningRef.current = false
      setIsScanning(false)
    }
  }, [handleDecode])

  // Stop scanning — closes the camera
  const stopScanning = useCallback(async () => {
    if (!scannerRef.current || !isRunningRef.current) return

    try {
      await scannerRef.current.stop()
    } catch (err) {
      console.warn('Error stopping scanner:', err)
    }

    // Clean up refs and state
    isRunningRef.current = false
    scannerRef.current = null
    setIsScanning(false)
    cooldownRef.current = false
    if (resultTimerRef.current) {
      clearTimeout(resultTimerRef.current)
      resultTimerRef.current = null
    }
  }, [])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left column: Scanner Camera and Mode Selectors */}
        <div className="lg:col-span-5 space-y-6">
          {/* Mode toggle */}
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-md">
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setScanMode('in')
                  setScanResult(null)
                  setWarnResult(null)
                  setErrorMsg('')
                }}
                className={`flex-1 rounded-xl py-3.5 text-sm font-bold shadow-sm transition-all active:scale-98 ${
                  scanMode === 'in'
                    ? 'bg-emerald-500 text-white shadow-emerald-500/20'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                CLOCK IN
              </button>
              <button
                onClick={() => {
                  setScanMode('out')
                  setScanResult(null)
                  setWarnResult(null)
                  setErrorMsg('')
                }}
                className={`flex-1 rounded-xl py-3.5 text-sm font-bold shadow-sm transition-all active:scale-98 ${
                  scanMode === 'out'
                    ? 'bg-amber-500 text-white shadow-amber-500/20'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                CLOCK OUT
              </button>
            </div>
          </div>

          {/* Clock Prominent Widget */}
          <div className="rounded-2xl border border-slate-100 bg-slate-900 text-white p-6 shadow-md text-center space-y-2">
            <div className="flex justify-center text-sky-400">
              <Clock size={28} className="animate-pulse" />
            </div>
            <p className="text-3xl font-extrabold tracking-wider font-mono">
              {now.toLocaleTimeString('en-US', { hour12: false })}
            </p>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
              {now.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          </div>

          {/* Start/Stop Button */}
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-md">
            {!isScanning ? (
              <button
                onClick={startScanning}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-sky-500 py-3 text-sm font-bold text-white shadow-md transition hover:bg-sky-600 active:scale-95"
              >
                <Camera size={16} />
                Start Scanning
              </button>
            ) : (
              <button
                onClick={stopScanning}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-500 py-3 text-sm font-bold text-white shadow-md transition hover:bg-red-600 active:scale-95"
              >
                <CameraOff size={16} />
                Stop Scanning
              </button>
            )}
          </div>

          {/* Scanner Area — NEVER put React children inside #qr-reader */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-full bg-sky-500" />
            {!isScanning && (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400 rounded-xl bg-slate-50">
                <Camera size={32} className="stroke-1 mb-2" />
                <p className="text-xs font-medium">
                  Click &quot;Start Scanning&quot; to open the camera
                </p>
              </div>
            )}
            <div
              id="qr-reader"
              style={{
                display: isScanning ? 'block' : 'none',
                width: '100%',
                minHeight: isScanning ? '300px' : '0px'
              }}
            />
          </div>
        </div>

        {/* Right column: Scan results & feedback card */}
        <div className="lg:col-span-7 flex flex-col justify-start">
          {/* Default Waiting Card */}
          {!scanResult && !warnResult && !errorMsg && (
            <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-slate-400 shadow-sm min-h-[400px]">
              <ScanLine size={64} className="stroke-1 text-slate-300 animate-pulse" />
              <h3 className="mt-4 text-base font-bold text-slate-700">Awaiting QR Scan</h3>
              <p className="text-sm text-slate-400 text-center max-w-xs mt-1">
                Please place the QR code on the printed staff ID card in front of the camera.
              </p>
            </div>
          )}

          {/* Error Feedback Card (real errors only — not "already scanned") */}
          {errorMsg && (
            <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-red-100 bg-red-50/50 p-12 text-center shadow-lg min-h-[400px] space-y-4">
              <div className="rounded-full bg-red-100 p-4 text-red-600 animate-bounce">
                <AlertTriangle size={36} />
              </div>
              <h3 className="text-lg font-bold text-red-800">Scan Failed</h3>
              <p className="text-sm font-medium max-w-sm leading-relaxed text-red-600">
                {errorMsg}
              </p>
              <button
                onClick={() => {
                  setErrorMsg('')
                  cooldownRef.current = false
                }}
                className="rounded-xl bg-red-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md transition hover:bg-red-700"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Already Scanned Warning Card */}
          {warnResult && (
            <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-amber-200 bg-amber-50/50 p-12 text-center shadow-lg min-h-[400px] space-y-4 relative overflow-hidden transition-all duration-300">
              <div className="absolute top-0 right-0 h-20 w-20 translate-x-6 -translate-y-6 rounded-full bg-amber-400/10 blur-xl" />
              <div className="rounded-full bg-amber-100 p-4 text-amber-600">
                <Info size={36} />
              </div>
              <h3 className="text-lg font-bold text-amber-800">Already Recorded</h3>
              <p className="text-sm font-medium max-w-sm leading-relaxed text-amber-700">
                {warnResult.message}
              </p>
              {warnResult.attendance && (
                <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
                  {warnResult.attendance.time_in && (
                    <div className="rounded-xl border border-amber-100 bg-white p-3 shadow-sm">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase">Time In</p>
                      <p className="mt-0.5 font-mono text-sm font-bold text-slate-800">
                        {warnResult.attendance.time_in}
                      </p>
                    </div>
                  )}
                  {warnResult.attendance.time_out && (
                    <div className="rounded-xl border border-amber-100 bg-white p-3 shadow-sm">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase">Time Out</p>
                      <p className="mt-0.5 font-mono text-sm font-bold text-slate-800">
                        {warnResult.attendance.time_out}
                      </p>
                    </div>
                  )}
                </div>
              )}
              {/* Auto-dismiss progress bar */}
              <div className="w-full max-w-xs">
                <div className="h-1.5 bg-amber-100 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 animate-[shrink_4s_linear_forwards]" />
                </div>
              </div>
            </div>
          )}

          {/* Success Result Card */}
          {scanResult && (
            <div className="flex flex-1 flex-col justify-between rounded-2xl border border-emerald-100 bg-emerald-50/30 p-8 shadow-lg min-h-[400px] relative overflow-hidden transition-all duration-300">
              {/* Success Badge Banner */}
              <div className="absolute top-0 right-0 h-16 w-16 translate-x-4 -translate-y-4 rounded-full bg-emerald-500/10 blur-xl" />

              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="rounded-full bg-emerald-100 p-2 text-emerald-600 shrink-0">
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-emerald-800">Scan Successful</h3>
                    <p className="text-xs text-emerald-600">{scanResult.message}</p>
                  </div>
                </div>

                {/* Profile card details */}
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center rounded-xl bg-white p-5 border border-slate-100 shadow-sm">
                  {/* Photo */}
                  <div className="h-20 w-20 overflow-hidden rounded-full ring-4 ring-slate-100 shrink-0 mx-auto sm:mx-0">
                    {scanResult.staff.photo_path ? (
                      <img
                        src={`media:///${scanResult.staff.photo_path.replace(/\\/g, '/')}`}
                        alt={scanResult.staff.name}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none'
                          e.target.nextSibling.style.display = 'flex'
                        }}
                      />
                    ) : null}
                    <div
                      className={`absolute inset-0 flex items-center justify-center bg-slate-100 text-xl font-bold text-slate-500 ${scanResult.staff.photo_path ? 'hidden' : ''}`}
                    >
                      {scanResult.staff.name?.[0]}
                    </div>
                  </div>

                  <div className="text-center sm:text-left space-y-1">
                    <h4 className="text-base font-bold text-slate-800">{scanResult.staff.name}</h4>
                    <p className="text-xs font-semibold text-sky-600">
                      {scanResult.staff.role_name || 'Staff'}
                    </p>
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                      ID: {scanResult.staff.formatted_id || scanResult.staff.staff_id}
                    </p>
                  </div>
                </div>

                {/* Log Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                      Time Recorded
                    </p>
                    <p className="mt-1 font-mono text-base font-bold text-slate-800">
                      {scanResult.attendance.time_in || scanResult.attendance.time_out || '--:--'}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                      Status Indicator
                    </p>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider mt-1 ${
                        ['Present', 'Active'].includes(scanResult.attendance.status)
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          : scanResult.attendance.status === 'Late'
                            ? 'bg-red-50 text-red-700 border border-red-100'
                            : 'bg-amber-50 text-amber-700 border border-amber-100'
                      }`}
                    >
                      {scanResult.attendance.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Progress timer bar */}
              <div className="border-t border-slate-100 pt-4 flex items-center justify-between text-xs text-slate-450">
                <span>Auto-resetting for next scan...</span>
                <div className="h-1.5 w-24 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 animate-[shrink_4s_linear_forwards]" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
        #qr-reader video {
          width: 100% !important;
          min-height: 300px !important;
          object-fit: cover;
          border-radius: 12px;
        }
        #qr-reader img[alt="scan-region-shade"] {
          display: none !important;
        }
      `}</style>
    </div>
  )
}
