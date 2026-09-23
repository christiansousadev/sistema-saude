import { buildAppIcon } from '../_pwa/icon-response'

// SERVE O ICONE DO APP EM 512X512 PARA O MANIFESTO PWA
export async function GET() {
  return buildAppIcon(512)
}
