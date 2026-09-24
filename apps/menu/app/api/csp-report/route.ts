import { handleCspReport } from '@garsonless/application/csp-report'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function POST(request: Request) {
  return handleCspReport(request, 'menu')
}
