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
} {
  if (imc < 18.5) return { label: 'Abaixo do peso', color: 'text-blue-600', bg: 'bg-blue-100' }
  if (imc < 25) return { label: 'Peso ideal', color: 'text-green-600', bg: 'bg-green-100' }
  if (imc < 30) return { label: 'Sobrepeso', color: 'text-yellow-600', bg: 'bg-yellow-100' }
  return { label: 'Obesidade', color: 'text-red-600', bg: 'bg-red-100' }
}

// posição (0-100%) do imc na escala visual 15-40
export function imcBarPct(imc: number): number {
  return Math.min(100, Math.max(0, ((imc - 15) / 25) * 100))
}
