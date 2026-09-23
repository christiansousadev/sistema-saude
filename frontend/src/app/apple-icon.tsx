import { buildAppIcon } from './_pwa/icon-response'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

// GERA O ICONE USADO AO ADICIONAR O APP A TELA DE INICIO NO IOS
export default function AppleIcon() {
  return buildAppIcon(180)
}
