import React, { useState } from 'react'
import {
  HardDriveDownload,
  HardDriveUpload,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react'
import ConfirmDialog from '../components/ui/ConfirmDialog'

export default function BackupRestorePage() {
  const [isBackingUp, setIsBackingUp] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [backupStatus, setBackupStatus] = useState({ type: '', message: '' })
  const [restoreStatus, setRestoreStatus] = useState({ type: '', message: '' })

  // Confirm dialog state
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false)
  const [selectedRestorePath, setSelectedRestorePath] = useState('')

  const handleCreateBackup = async () => {
    setBackupStatus({ type: '', message: '' })
    try {
      const defaultName = `attendease_backup_${new Date().toISOString().split('T')[0]}.zip`
      const fileDialogRes = await window.api.saveFileDialog({
        title: 'Choose Backup Location',
        defaultPath: defaultName,
        filters: [{ name: 'Zip Archive', extensions: ['zip'] }]
      })

      const targetPath = typeof fileDialogRes === 'object' ? fileDialogRes.filePath : fileDialogRes
      const isCanceled = typeof fileDialogRes === 'object' ? fileDialogRes.canceled : !targetPath

      if (isCanceled || !targetPath) return

      setIsBackingUp(true)
      const res = await window.api.backupSystem(targetPath)
      if (res.success) {
        setBackupStatus({
          type: 'success',
          message: `Backup created successfully at:\n${targetPath}`
        })
      } else {
        setBackupStatus({
          type: 'error',
          message: res.message || 'Failed to create backup.'
        })
      }
    } catch (err) {
      console.error(err)
      setBackupStatus({ type: 'error', message: 'IPC error: Could not complete backup.' })
    } finally {
      setIsBackingUp(false)
    }
  }

  const handleSelectRestoreFile = async () => {
    setRestoreStatus({ type: '', message: '' })
    try {
      const fileDialogRes = await window.api.openFileDialog({
        title: 'Select Backup Archive to Restore',
        properties: ['openFile'],
        filters: [{ name: 'Zip Archive', extensions: ['zip'] }]
      })

      const targetPath =
        typeof fileDialogRes === 'object' ? fileDialogRes.filePaths?.[0] : fileDialogRes?.[0]
      const isCanceled = typeof fileDialogRes === 'object' ? fileDialogRes.canceled : !targetPath

      if (isCanceled || !targetPath) return

      setSelectedRestorePath(targetPath)
      setIsRestoreConfirmOpen(true)
    } catch (err) {
      console.error(err)
      setRestoreStatus({ type: 'error', message: 'Failed to open file browser.' })
    }
  }

  const handleConfirmRestore = async () => {
    if (!selectedRestorePath) return
    setIsRestoring(true)
    setRestoreStatus({ type: '', message: '' })
    try {
      const res = await window.api.restoreSystem(selectedRestorePath)
      if (res.success) {
        setRestoreStatus({
          type: 'success',
          message:
            'System database and staff photos restored successfully. Please restart the application if any inconsistencies appear.'
        })
      } else {
        setRestoreStatus({
          type: 'error',
          message: res.message || 'Failed to restore system backup. Archive might be corrupted.'
        })
      }
    } catch (err) {
      console.error(err)
      setRestoreStatus({ type: 'error', message: 'IPC error: Restore operation crashed.' })
    } finally {
      setIsRestoring(false)
      setSelectedRestorePath('')
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Backup Card */}
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-lg flex flex-col justify-between space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 h-20 w-20 translate-x-4 -translate-y-4 rounded-full bg-sky-500/5 blur-xl" />

          <div className="space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50 text-sky-600 shadow-sm">
              <HardDriveDownload size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Create System Backup</h2>
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                Generates a secure compressed ZIP archive containing the local SQLite database and
                all uploaded staff photographs. Backups should be saved in a safe external location
                regularly.
              </p>
            </div>

            {backupStatus.message && (
              <div
                className={`flex items-start gap-2 rounded-xl border p-4 text-xs leading-relaxed ${
                  backupStatus.type === 'success'
                    ? 'border-emerald-500/20 bg-emerald-50/50 text-emerald-700'
                    : 'border-red-500/20 bg-red-50/50 text-red-650'
                }`}
              >
                {backupStatus.type === 'success' ? (
                  <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                )}
                <span className="whitespace-pre-line">{backupStatus.message}</span>
              </div>
            )}
          </div>

          <button
            onClick={handleCreateBackup}
            disabled={isBackingUp}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 py-3 text-sm font-bold text-black shadow-md hover:bg-sky-600 transition active:scale-98 disabled:opacity-50"
          >
            {isBackingUp ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Creating Backup...</span>
              </>
            ) : (
              <>
                <HardDriveDownload size={16} />
                <span>Create Backup ZIP</span>
              </>
            )}
          </button>
        </div>

        {/* Restore Card */}
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-lg flex flex-col justify-between space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 h-20 w-20 translate-x-4 -translate-y-4 rounded-full bg-amber-500/5 blur-xl" />

          <div className="space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600 shadow-sm">
              <HardDriveUpload size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Restore System Backup</h2>
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                Restores a previous database and photos archive.{' '}
                <strong className="text-amber-600">WARNING:</strong> This will overwrite all current
                staff profiles, settings, and attendance records on this device.
              </p>
            </div>

            {restoreStatus.message && (
              <div
                className={`flex items-start gap-2 rounded-xl border p-4 text-xs leading-relaxed ${
                  restoreStatus.type === 'success'
                    ? 'border-emerald-500/20 bg-emerald-50/50 text-emerald-700'
                    : 'border-red-500/20 bg-red-50/50 text-red-650'
                }`}
              >
                {restoreStatus.type === 'success' ? (
                  <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                )}
                <span>{restoreStatus.message}</span>
              </div>
            )}
          </div>

          <button
            onClick={handleSelectRestoreFile}
            disabled={isRestoring}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-250 bg-amber-50 py-3 text-sm font-bold text-amber-700 transition hover:bg-amber-100 active:scale-98 disabled:opacity-50"
          >
            {isRestoring ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-amber-700" />
                <span>Restoring System...</span>
              </>
            ) : (
              <>
                <HardDriveUpload size={16} />
                <span>Restore Backup ZIP</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Confirm Restore Dialog */}
      <ConfirmDialog
        isOpen={isRestoreConfirmOpen}
        onClose={() => setIsRestoreConfirmOpen(false)}
        onConfirm={handleConfirmRestore}
        title="DANGER: Restore Backup File"
        message={`You are about to restore the system backup from: \n"${selectedRestorePath}"\n\nThis will completely erase all current staff logs, configurations, and photos on this machine. This process cannot be undone. Are you absolutely sure?`}
        confirmText="Erase & Restore"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  )
}
