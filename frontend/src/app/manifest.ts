import type { MetadataRoute } from 'next'

// DEFINE O MANIFESTO PWA DO SISTEMA SAUDE
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Sistema Saúde — Rastreamento Pessoal',
    short_name: 'Saúde',
    description:
      'Plataforma de evolução física, exames clínicos e assistente de saúde inteligente.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#020617',
    theme_color: '#020617',
    icons: [
      { src: '/icon-192', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512', sizes: '512x512', type: 'image/png' },
    ],
  }
}
