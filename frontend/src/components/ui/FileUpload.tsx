'use client'

import { useRef, useState } from 'react'
import { File as FileIcon, FileText, Upload, X } from 'lucide-react'
import { formatBytes } from '@/lib/utils'

interface FileUploadProps {
  label?: string
  accept?: string
  maxMB?: number
  preview?: boolean
  onChange: (file: File | null) => void
  className?: string
}

export default function FileUpload({
  label,
  accept,
  maxMB = 10,
  preview = false,
  onChange,
  className = '',
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [sizeError, setSizeError] = useState<string | null>(null)

  function handleFile(f: File) {
    if (f.size > maxMB * 1024 * 1024) {
      setSizeError(`Arquivo excede ${maxMB} MB`)
      return
    }
    setSizeError(null)
    setFile(f)
    onChange(f)

    if (preview && f.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => setPreviewUrl(e.target?.result as string)
      reader.readAsDataURL(f)
    } else {
      setPreviewUrl(null)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) handleFile(dropped)
  }

  function clear() {
    setFile(null)
    setPreviewUrl(null)
    setSizeError(null)
    onChange(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const isPdf = file?.type === 'application/pdf'

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && <span className="text-sm font-medium text-slate-300">{label}</span>}

      {!file ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={[
            'flex min-h-[132px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition',
            dragging
              ? 'border-emerald-400/60 bg-emerald-500/[0.06]'
              : 'border-white/10 bg-white/[0.02] hover:border-sky-500/40 hover:bg-sky-500/[0.04]',
          ].join(' ')}
        >
          <Upload
            className={`h-7 w-7 transition ${dragging ? 'text-emerald-400' : 'text-slate-500'}`}
            strokeWidth={1.75}
          />
          <p className="text-sm text-slate-400">
            <span className="font-medium text-sky-400">Clique para selecionar</span> ou arraste aqui
          </p>
          {accept && (
            <p className="text-xs text-slate-500">{accept.replace(/,/g, ', ')} · máx. {maxMB} MB</p>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="preview" className="h-14 w-14 rounded-lg object-cover" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-white/5">
              {isPdf ? (
                <FileText className="h-6 w-6 text-rose-400" strokeWidth={1.75} />
              ) : (
                <FileIcon className="h-6 w-6 text-slate-400" strokeWidth={1.75} />
              )}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-200">{file.name}</p>
            <p className="text-xs text-slate-500">{formatBytes(file.size)}</p>
          </div>

          <button
            type="button"
            onClick={clear}
            className="ml-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Remover arquivo"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />

      {sizeError && <p className="text-xs text-rose-400">{sizeError}</p>}
    </div>
  )
}
