import { ImageResponse } from 'next/og'

// GERA O ICONE DO APP EM QUALQUER TAMANHO A PARTIR DE UM UNICO DESENHO BASE
export function buildAppIcon(px: number) {
  const strokeWidth = Math.max(1.5, px / 48)
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #34d399 0%, #0ea5e9 100%)',
        }}
      >
        <svg
          width={px * 0.58}
          height={px * 0.58}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#020617"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      </div>
    ),
    { width: px, height: px }
  )
}
