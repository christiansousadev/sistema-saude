'use client'

import { useEffect } from 'react'

// COMPONENTE CLIENT-SIDE PARA REGISTRO DO SERVICE WORKER PWA
export default function PwaRegistrar() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => {
            // registro concluido com sucesso
            reg.update().catch(() => {})
          })
          .catch(() => {
            // falha silenciosa de registro
          })
      })
    } else if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      // em ambiente de desenvolvimento registra tambem para teste
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          reg.update().catch(() => {})
        })
        .catch(() => {})
    }
  }, [])

  return null
}
