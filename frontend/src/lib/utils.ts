export function getFileUrl(relativePath: string): string {
  const base =
    process.env.NEXT_PUBLIC_STORAGE_URL ?? 'http://localhost:8000/uploads'
  return `${base}/${relativePath}`
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function calcImc(weightKg: number, heightCm: number): number {
  const h = heightCm / 100
  return weightKg / (h * h)
}

export function imcCategory(imc: number): {
  label: string
  color: string
  bg: string
  border: string
} {
  if (imc < 18.5)
    return { label: 'Abaixo do peso', color: 'text-sky-300', bg: 'bg-sky-500/10', border: 'border-sky-500/20' }
  if (imc < 25)
    return { label: 'Peso ideal', color: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' }
  if (imc < 30)
    return { label: 'Sobrepeso', color: 'text-amber-300', bg: 'bg-amber-500/10', border: 'border-amber-500/20' }
  return { label: 'Obesidade', color: 'text-rose-300', bg: 'bg-rose-500/10', border: 'border-rose-500/20' }
}

// posição (0-100%) do imc na escala visual 15-40
export function imcBarPct(imc: number): number {
  return Math.min(100, Math.max(0, ((imc - 15) / 25) * 100))
}

// EXTRAI AS INICIAIS DE UM NOME PARA USO EM AVATARES
export function initials(name?: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
}
