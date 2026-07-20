import { readDashboardInsightsHealth } from '../src/dashboard-read-model-health'
import {
  buildDashboardInsightsHealthAlertPayload,
  buildDashboardInsightsUnavailableAlertPayload,
  deliverDashboardInsightsHealthAlert,
  type DashboardInsightsHealthAlertPayload,
} from '../src/dashboard-read-model-health-alert'

const environment = process.env.DASHBOARD_INSIGHTS_HEALTH_ENVIRONMENT ?? process.env.NODE_ENV ?? 'unknown'
const webhookUrl = process.env.DASHBOARD_INSIGHTS_ALERT_WEBHOOK_URL?.trim()

async function notify(payload: DashboardInsightsHealthAlertPayload) {
  if (!webhookUrl) return true
  const delivery = await deliverDashboardInsightsHealthAlert({ webhookUrl, payload })
  if (delivery.ok) return true
  console.error(JSON.stringify({ status: 'alert-delivery-failed', error: delivery.error }))
  return false
}

async function main() {
  try {
    const result = await readDashboardInsightsHealth()
    if (!result.ok) {
      const delivered = await notify(buildDashboardInsightsUnavailableAlertPayload({ environment }))
      console.error(JSON.stringify({ status: 'unavailable', error: 'health-read-failed' }))
      process.exitCode = delivered ? 2 : 3
    } else {
      console.log(JSON.stringify(result.value, null, 2))
      const payload = buildDashboardInsightsHealthAlertPayload(result.value, { environment })
      if (payload) {
        const delivered = await notify(payload)
        process.exitCode = delivered ? 1 : 3
      }
    }
  } catch {
    const delivered = await notify(buildDashboardInsightsUnavailableAlertPayload({ environment }))
    console.error(JSON.stringify({ status: 'unavailable', error: 'health-check-failed' }))
    process.exitCode = delivered ? 2 : 3
  }
}

void main()
