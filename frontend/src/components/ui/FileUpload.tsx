'use client'

import { useRef, useState } from 'react'
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
      {label && (
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
      )}

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
            'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 transition',
            dragging
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
              : 'border-slate-300 hover:border-primary-400 hover:bg-slate-50 dark:border-slate-600 dark:hover:border-primary-500 dark:hover:bg-slate-800/50',
          ].join(' ')}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            className="h-8 w-8 text-slate-400"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            <span className="font-medium text-primary-600 dark:text-primary-400">Clique para selecionar</span>
            {' '}ou arraste aqui
          </p>
          {accept && (
            <p className="text-xs text-slate-400">{accept.replace(/,/g, ', ')} · máx. {maxMB} MB</p>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="preview" className="h-14 w-14 rounded-lg object-cover" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-slate-200 dark:bg-slate-700">
              {isPdf ? (
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7 text-red-500">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM9.5 17.5h-1V15H7v2.5H6V13h1v1.5h1.5V13h1v4.5zm2.5-1.1c0 .7-.4 1.1-1.2 1.1H9.5V13H11c.7 0 1 .3 1 .9v.1c0 .4-.2.6-.5.7.4.1.5.4.5.7v.2zm3.3-2.4h-1.5v1h1.3v.9h-1.3v1.6H13V13h2.3v1z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7 text-slate-400">
                  <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9l-7-7z" />
                </svg>
              )}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
              {file.name}
            </p>
            <p className="text-xs text-slate-400">{formatBytes(file.size)}</p>
          </div>

          <button
            type="button"
            onClick={clear}
            className="ml-1 rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300 transition"
            aria-label="Remover arquivo"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
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

      {sizeError && <p className="text-xs text-red-500">{sizeError}</p>}
    </div>
  )
}
