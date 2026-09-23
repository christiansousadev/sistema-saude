import { buildAppIcon } from './_pwa/icon-response'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

// GERA O FAVICON EXIBIDO NA ABA DO NAVEGADOR
export default function Icon() {
  return buildAppIcon(32)
}
