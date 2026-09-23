import { buildAppIcon } from '../_pwa/icon-response'

// SERVE O ICONE DO APP EM 192X192 PARA O MANIFESTO PWA
export async function GET() {
  return buildAppIcon(192)
}
