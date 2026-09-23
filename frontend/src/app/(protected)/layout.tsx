'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Spinner from '@/components/ui/Spinner'
import Navbar from '@/components/layout/Navbar'

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login')
  }, [user, isLoading, router])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Spinner size="lg" className="text-emerald-400" />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="flex min-h-screen flex-col bg-slate-950">
      <Navbar />
      {/* padding inferior soma a barra de gestos do ios/android para o conteúdo nunca ficar coberto */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-8 pb-[calc(2rem+env(safe-area-inset-bottom,0px))]">
        {children}
      </main>
    </div>
  )
}
