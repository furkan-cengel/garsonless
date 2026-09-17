import { notFound } from "next/navigation";
import { executeInventory } from "@garsonless/application/inventory";
import {
  canRestaurantUseFeature,
  createInventoryPort,
} from "@garsonless/db/server";
import type { InventorySnapshot } from "@garsonless/domain/inventory";
import { requireSection } from "../../../../lib/auth/access";
import { getRestaurantById } from "../../../../lib/queries/restaurants";
import { readBillingPlanPrices } from "../../../../lib/billing/subscription-billing-request";
import PlanLockedPanel from "../../../../components/PlanLockedPanel";
import InventoryWorkspace from "../../../../components/inventory/InventoryWorkspace";
export default async function InventoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ restaurantId: string }>;
  searchParams: Promise<{ menuItemId?: string }>;
}) {
  const { restaurantId } = await params;
  const { menuItemId } = await searchParams;
  const access = await requireSection(restaurantId, "inventory");
  const restaurant = await getRestaurantById(restaurantId);
  if (!restaurant) notFound();
  if (
    !(await canRestaurantUseFeature({
      restaurantId,
      plan: restaurant.plan,
      feature: "inventory_management",
    }))
  )
    return (
      <PlanLockedPanel
        restaurantId={restaurantId}
        currentPlan={restaurant.plan}
        feature="inventory_management"
        isOwner={access.isOwner}
        planPrices={readBillingPlanPrices()}
      />
    );
  const result = await executeInventory(
    {
      actor: "dashboard-member",
      restaurantId,
      userId: access.userId,
      permissions: access.permissions,
      isOwner: access.isOwner,
    },
    { restaurantId, mode: "snapshot" },
    createInventoryPort(),
  );
  return (
    <InventoryWorkspace
      initialError={result.ok ? undefined : result.error}
      initialMenuItemId={menuItemId}
      restaurantId={restaurantId}
      isOwner={access.isOwner}
      initial={result.ok ? (result.data as InventorySnapshot) : null}
    />
  );
}
