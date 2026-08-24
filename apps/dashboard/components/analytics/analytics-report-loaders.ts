import type { AnalyticsReportId } from '../../lib/actions/analytics'

const reportLoaders: Record<AnalyticsReportId, () => Promise<unknown>> = {
  sales: () => Promise.all([
    import('./AnalyticsSalesPaymentReports'),
    import('./chart-primitives/SalesLineChart'),
    import('./chart-primitives/PaymentDonutChart'),
  ]),
  payments: () => Promise.all([
    import('./AnalyticsSalesPaymentReports'),
    import('./chart-primitives/PaymentDonutChart'),
  ]),
  items: () => Promise.all([
    import('./AnalyticsItemsReport'),
    import('./chart-primitives/ProductScatterChart'),
  ]),
  tables: () => import('./AnalyticsTablesReport'),
  operasyon: () => import('./AnalyticsOperationsReport'),
  sadakat: () => import('./AnalyticsLoyaltyReport'),
}

export const loadAnalyticsSalesReport = () => import('./AnalyticsSalesPaymentReports')
  .then((module) => module.AnalyticsSalesReport)
export const loadAnalyticsPaymentsReport = () => import('./AnalyticsSalesPaymentReports')
  .then((module) => module.AnalyticsPaymentsReport)
export const loadAnalyticsItemsReport = () => import('./AnalyticsItemsReport')
  .then((module) => module.AnalyticsItemsReport)
export const loadAnalyticsTablesReport = () => import('./AnalyticsTablesReport')
  .then((module) => module.AnalyticsTablesReport)
export const loadAnalyticsOperationsReport = () => import('./AnalyticsOperationsReport')
  .then((module) => module.AnalyticsOperationsReport)
export const loadAnalyticsLoyaltyReport = () => import('./AnalyticsLoyaltyReport')
  .then((module) => module.AnalyticsLoyaltyReport)

/** Starts both the report component and its chart chunk before selection. */
export function preloadAnalyticsReport(report: AnalyticsReportId): void {
  void reportLoaders[report]().catch(() => undefined)
}
