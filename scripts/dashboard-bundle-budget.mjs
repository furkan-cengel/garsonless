import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyTablesBundleBudgets } from "./tables-bundle-budget.mjs";

const withRegressionGate = ({
  baselineInitialGzipBytes,
  hardMaxInitialGzipBytes,
  baselineReadyGzipBytes,
  ...budget
}) => ({
  ...budget,
  baselineInitialGzipBytes,
  hardMaxInitialGzipBytes,
  maxRegressionPercent: 5,
  baselineReadyGzipBytes,
  maxReadyGzipBytes: Math.ceil(baselineReadyGzipBytes * 1.05),
  maxEntryGzipBytes: hardMaxInitialGzipBytes,
  maxInitialGzipBytes: Math.min(
    hardMaxInitialGzipBytes,
    Math.ceil(baselineInitialGzipBytes * 1.05),
  ),
});

export const DASHBOARD_BUNDLE_BUDGETS = Object.freeze([
  withRegressionGate({
    label: "Dashboard",
    publicRoute: "/dashboard",
    manifestRoute: "/dashboard/[restaurantId]/page",
    entryDirectory: "static/chunks/app/dashboard/[restaurantId]/",
    baselineInitialGzipBytes: 193_334,
    hardMaxInitialGzipBytes: 200_000,
    baselineReadyGzipBytes: 247176,
    eagerDynamicImports: [
      "components/pano/PanoClient.tsx -> ./PanoSalesChart",
      "components/pano/PanoClient.tsx -> ./PanoActivityFeed",
      "components/pano/use-pano-live-state.ts -> ../../lib/supabase",
      "components/layout/RestaurantShell.tsx -> ../../lib/supabase",
    ],
  }),
  withRegressionGate({
    label: "Analytics",
    publicRoute: "/analytics",
    manifestRoute: "/dashboard/[restaurantId]/analytics/page",
    entryDirectory: "static/chunks/app/dashboard/[restaurantId]/analytics/",
    baselineInitialGzipBytes: 136_207,
    hardMaxInitialGzipBytes: 160_000,
    baselineReadyGzipBytes: 406836,
    eagerDynamicImports: [
      "components/analytics/AnalyticsClientBoundary.tsx -> ./AnalyticsClient",
      "components/analytics/analytics-report-loaders.ts -> ./AnalyticsSalesPaymentReports",
      "components/analytics/AnalyticsSalesPaymentReports.tsx -> ./chart-primitives/SalesLineChart",
      "components/layout/RestaurantShell.tsx -> ../../lib/supabase",
    ],
  }),
  withRegressionGate({
    label: "Customers",
    publicRoute: "/customers",
    manifestRoute: "/dashboard/[restaurantId]/customers/page",
    entryDirectory: "static/chunks/app/dashboard/[restaurantId]/customers/",
    baselineInitialGzipBytes: 126_962,
    hardMaxInitialGzipBytes: 160_000,
    baselineReadyGzipBytes: 298848,
    eagerDynamicImports: [
      "components/customers/CustomersClientBoundary.tsx -> ./CustomersClient",
      "components/layout/RestaurantShell.tsx -> ../../lib/supabase",
    ],
  }),
  withRegressionGate({
    label: "Settings",
    publicRoute: "/settings",
    manifestRoute: "/dashboard/[restaurantId]/settings/page",
    entryDirectory: "static/chunks/app/dashboard/[restaurantId]/settings/",
    baselineInitialGzipBytes: 123_412,
    hardMaxInitialGzipBytes: 160_000,
    baselineReadyGzipBytes: 225238,
    eagerDynamicImports: [
      "components/settings/SettingsFormLoader.tsx -> ./SettingsForm",
      "components/settings/SettingsForm.tsx -> ./WorkspaceSection",
      "components/layout/RestaurantShell.tsx -> ../../lib/supabase",
    ],
  }),
  withRegressionGate({
    label: "Menu",
    publicRoute: "/menu",
    manifestRoute: "/dashboard/[restaurantId]/menu/page",
    entryDirectory: "static/chunks/app/dashboard/[restaurantId]/menu/",
    baselineInitialGzipBytes: 154_930,
    hardMaxInitialGzipBytes: 220_000,
    baselineReadyGzipBytes: 340620,
    eagerDynamicImports: [
      "components/menu/MenuManagerBoundary.tsx -> ./MenuManager",
      "components/menu/use-menu-live-state.ts -> ../../lib/supabase",
      "components/layout/RestaurantShell.tsx -> ../../lib/supabase",
    ],
  }),
  withRegressionGate({
    label: "Tables",
    publicRoute: "/tables",
    manifestRoute: "/dashboard/[restaurantId]/tables/page",
    entryDirectory: "static/chunks/app/dashboard/[restaurantId]/tables/",
    baselineInitialGzipBytes: 147_334,
    hardMaxInitialGzipBytes: 220_000,
    baselineReadyGzipBytes: 316645,
    eagerDynamicImports: [
      "components/tables/TablesOperationsClientLoader.tsx -> ./TablesOperationsShell",
      "components/tables/TablesNavigation.tsx -> ./TablesFloorCanvas",
      "components/tables/use-tables-realtime-channel.ts -> ./tables-realtime-channel-runtime",
      "components/layout/RestaurantShell.tsx -> ../../lib/supabase",
    ],
  }),
  withRegressionGate({
    label: "Orders",
    publicRoute: "/orders",
    manifestRoute: "/dashboard/[restaurantId]/orders/page",
    entryDirectory: "static/chunks/app/dashboard/[restaurantId]/orders/",
    baselineInitialGzipBytes: 222_904,
    hardMaxInitialGzipBytes: 250_000,
    baselineReadyGzipBytes: 303070,
    eagerDynamicImports: [
      "components/orders/OrderBoardBoundary.tsx -> ./OrderBoard",
      "components/orders/OrderBoard.tsx -> ./OrderBoardDnd",
      "components/layout/RestaurantShell.tsx -> ../../lib/supabase",
    ],
  }),
  withRegressionGate({
    label: "QR Studio",
    publicRoute: "/tables/qr",
    manifestRoute: "/dashboard/[restaurantId]/tables/qr/page",
    entryDirectory: "static/chunks/app/dashboard/[restaurantId]/tables/qr/",
    baselineInitialGzipBytes: 149_024,
    hardMaxInitialGzipBytes: 155_000,
    baselineReadyGzipBytes: 354189,
    eagerDynamicImports: [
      "components/tables/TablesBuilderClientLoader.tsx -> ./TablesBuilderShell",
      "components/tables/TablesBuilderShell.tsx -> ./TablesQRProperties",
      "components/tables/tables-qr-renderer.ts -> qr-code-styling",
      "components/layout/RestaurantShell.tsx -> ../../lib/supabase",
    ],
  }),
  withRegressionGate({
    label: "Onboarding",
    publicRoute: "/onboarding",
    manifestRoute: "/dashboard/onboarding/page",
    entryDirectory: "static/chunks/app/dashboard/onboarding/",
    baselineInitialGzipBytes: 132_697,
    hardMaxInitialGzipBytes: 180_000,
    // Re-baselined after the media picker left the initial bundle (220 KB ->
    // 138 KB); the remaining growth is onboarding activation analytics.
    baselineReadyGzipBytes: 137965,
    eagerDynamicImports: [],
  }),
  withRegressionGate({
    label: "Theme",
    publicRoute: "/theme",
    manifestRoute: "/dashboard/[restaurantId]/theme/page",
    entryDirectory: "static/chunks/app/dashboard/[restaurantId]/theme/",
    baselineInitialGzipBytes: 119_924,
    hardMaxInitialGzipBytes: 140_000,
    baselineReadyGzipBytes: 535203,
    eagerDynamicImports: [
      "components/theme/ThemeEditorClientLoader.tsx -> ./ThemeEditorClient",
      "../../packages/ui/src/menu/ThemeContext.tsx -> ./ThemePreviewBridge",
      "components/layout/RestaurantShell.tsx -> ../../lib/supabase",
    ],
  }),
]);

export function verifyDashboardBundleBudgets({
  buildDirectory = "apps/dashboard/.next",
  budgets = DASHBOARD_BUNDLE_BUDGETS,
} = {}) {
  const evidence = verifyTablesBundleBudgets({ buildDirectory, budgets });
  return { ...evidence, kind: "dashboard-critical-route-bundle-budget" };
}

function parseArguments(argumentsList) {
  const options = { buildDirectory: "apps/dashboard/.next", output: null };
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--") continue;
    if (argument === "--build-dir") {
      options.buildDirectory = argumentsList[index + 1];
      index += 1;
      continue;
    }
    if (argument === "--output") {
      options.output = argumentsList[index + 1];
      index += 1;
      continue;
    }
    throw new Error(`Bilinmeyen argüman: ${argument}`);
  }
  return options;
}

export function runDashboardBundleBudgetCli(
  argumentsList = process.argv.slice(2),
) {
  const options = parseArguments(argumentsList);
  const evidence = verifyDashboardBundleBudgets({
    buildDirectory: options.buildDirectory,
  });
  for (const route of evidence.routes) {
    console.log(
      `PASS ${route.publicRoute}: ${(route.initialGzipBytes / 1000).toFixed(1)}/${(route.maxInitialGzipBytes / 1000).toFixed(1)} kB gzip; ready ${(route.readyGzipBytes / 1000).toFixed(1)}/${(route.maxReadyGzipBytes / 1000).toFixed(1)} kB`,
    );
  }
  if (options.output) {
    const outputPath = resolve(options.output);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, {
      mode: 0o600,
    });
    console.log(`Evidence: ${outputPath}`);
  }
  return evidence;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    runDashboardBundleBudgetCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
