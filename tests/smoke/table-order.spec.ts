import { loadEnvFile } from "node:process";
import { expect, test } from "@playwright/test";
import {
  createClient,
  createServiceClient,
} from "../../packages/db/src/client";
import { createKitchenLaunchTicket } from "../../packages/db/src/kitchen-session";
import { cancelOrderDB } from "../../packages/db/src/orders-update";

const DEV_PROJECT_REF = "yxsegwkzyiscrxiwdeuf";
const menuURL = process.env["SMOKE_MENU_URL"] ?? "http://127.0.0.1:3011";
const dashboardURL =
  process.env["SMOKE_DASHBOARD_URL"] ?? "http://127.0.0.1:3005";
const kitchenURL =
  process.env["SMOKE_KITCHEN_URL"] ?? "http://127.0.0.1:3002";
const menuSlug = process.env["SMOKE_MENU_SLUG"] ?? "maf-lounge";
const mutationEnabled = process.env["SMOKE_ALLOW_ORDER_MUTATION"] === "1";

function dashboardSessionCookies(session: unknown) {
  const projectRef = new URL(process.env["NEXT_PUBLIC_SUPABASE_URL"]!).hostname.split(".")[0]!;
  const baseName = `sb-${projectRef}-auth-token`;
  const value = `base64-${Buffer.from(JSON.stringify(session), "utf8").toString("base64url")}`;
  const chunks = value.match(/.{1,3180}/g) ?? [value];
  return chunks.map((chunk, index) => ({
    name: chunks.length === 1 ? baseName : `${baseName}.${index}`,
    value: chunk,
    url: dashboardURL,
    sameSite: "Lax" as const,
  }));
}

test.describe("real table QR golden order", () => {
  test.skip(
    !mutationEnabled,
    "Set SMOKE_ALLOW_ORDER_MUTATION=1 to run the reversible DEV golden-order fixture.",
  );

  let restoreFixture: (() => Promise<void>) | undefined;

  test.afterEach(async () => {
    if (!restoreFixture) return;
    const restore = restoreFixture;
    restoreFixture = undefined;
    await restore();
  });

  test("modifier, removal, upsell and note survive cart, retry and order snapshot", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    loadEnvFile("apps/menu/.env.local");
    expect(process.env["NEXT_PUBLIC_SUPABASE_URL"]).toContain(DEV_PROJECT_REF);

    const service = createServiceClient();
    const { data: restaurant, error: restaurantError } = await service
      .from("restaurants")
      .select("id, slug, owner_id")
      .eq("slug", menuSlug)
      .single();
    expect(restaurantError).toBeNull();
    expect(restaurant).not.toBeNull();

    const { data: categories, error: categoryError } = await service
      .from("menu_categories")
      .select("id")
      .eq("restaurant_id", restaurant!.id)
      .eq("is_visible", true)
      .is("deleted_at", null);
    expect(categoryError).toBeNull();

    const { data: fixtureItems, error: itemError } = await service
      .from("menu_items")
      .select("id, name, price, modifier_groups, ingredients")
      .in(
        "category_id",
        (categories ?? []).map((category) => category.id),
      )
      .eq("is_available", true)
      .is("deleted_at", null)
      .order("position")
      .limit(3);
    expect(itemError).toBeNull();
    expect(fixtureItems?.length).toBe(3);
    const [sourceItem, recommendationItem, simpleItem] = fixtureItems!;

    const { data: originalRecommendations, error: recommendationReadError } =
      await service
        .from("menu_item_recommendations")
        .select("recommended_item_id, position")
        .eq("restaurant_id", restaurant!.id)
        .eq("source_item_id", sourceItem!.id)
        .order("position");
    expect(recommendationReadError).toBeNull();

    const requiredGroup = {
      id: "smoke-required-group",
      name: "Smoke zorunlu seçim",
      selection_mode: "single",
      required: true,
      min: 1,
      max: 1,
      options: [
        {
          id: "smoke-required-option",
          name: "Smoke standart seçim",
          price_delta: 0,
          calorie_delta: 0,
          is_default: false,
          allergen_codes: [],
        },
      ],
    };
    const removableIngredient = {
      id: "smoke-removable-ingredient",
      name: "Smoke sos",
      removable: true,
      allergen_codes: [],
    };
    const upsellGroup = {
      ...requiredGroup,
      id: "smoke-upsell-group",
      name: "Smoke upsell seçimi",
      options: [
        {
          ...requiredGroup.options[0],
          id: "smoke-upsell-option",
          name: "Smoke upsell standart",
        },
      ],
    };
    const fixtureState: { createdOrderId?: string } = {};

    restoreFixture = async () => {
      const cleanupErrors: unknown[] = [];
      const capture = (error: unknown) => {
        if (error) cleanupErrors.push(error);
      };

      capture(
        (
          await service
            .from("menu_item_recommendations")
            .delete()
            .eq("source_item_id", sourceItem!.id)
        ).error,
      );
      if ((originalRecommendations ?? []).length > 0) {
        capture(
          (
            await service.from("menu_item_recommendations").insert(
              originalRecommendations!.map((row) => ({
                restaurant_id: restaurant!.id,
                source_item_id: sourceItem!.id,
                recommended_item_id: row.recommended_item_id,
                position: row.position,
              })),
            )
          ).error,
        );
      }
      capture(
        (
          await service
            .from("menu_items")
            .update({
              modifier_groups: sourceItem!.modifier_groups,
              ingredients: sourceItem!.ingredients,
            })
            .eq("id", sourceItem!.id)
        ).error,
      );
      capture(
        (
          await service
            .from("menu_items")
            .update({
              modifier_groups: recommendationItem!.modifier_groups,
              ingredients: recommendationItem!.ingredients,
            })
            .eq("id", recommendationItem!.id)
        ).error,
      );
      capture(
        (
          await service
            .from("menu_items")
            .update({
              modifier_groups: simpleItem!.modifier_groups,
              ingredients: simpleItem!.ingredients,
            })
            .eq("id", simpleItem!.id)
        ).error,
      );
      if (fixtureState.createdOrderId) {
        const cancellation = await cancelOrderDB(fixtureState.createdOrderId, restaurant!.id, {
          reason: "Golden-order smoke test cleanup",
        });
        capture(cancellation.error ? new Error(cancellation.error) : null);
      }

      if (cleanupErrors.length > 0) {
        throw new AggregateError(
          cleanupErrors,
          "Golden-order fixture cleanup failed",
        );
      }
    };

    const { error: sourceUpdateError } = await service
      .from("menu_items")
      .update({
        modifier_groups: [requiredGroup],
        ingredients: [removableIngredient],
      })
      .eq("id", sourceItem!.id);
    expect(sourceUpdateError).toBeNull();
    const { error: recommendationUpdateError } = await service
      .from("menu_items")
      .update({ modifier_groups: [upsellGroup], ingredients: [] })
      .eq("id", recommendationItem!.id);
    expect(recommendationUpdateError).toBeNull();
    const { error: simpleUpdateError } = await service
      .from("menu_items")
      .update({ modifier_groups: [], ingredients: [] })
      .eq("id", simpleItem!.id);
    expect(simpleUpdateError).toBeNull();
    expect(
      (
        await service
          .from("menu_item_recommendations")
          .delete()
          .eq("source_item_id", sourceItem!.id)
      ).error,
    ).toBeNull();
    expect(
      (
        await service.from("menu_item_recommendations").insert({
          restaurant_id: restaurant!.id,
          source_item_id: sourceItem!.id,
          recommended_item_id: recommendationItem!.id,
          position: 0,
        })
      ).error,
    ).toBeNull();

    const { data: qrToken, error: qrTokenError } = await service
      .from("table_qr_tokens")
      .select("token, table_id")
      .eq("restaurant_id", restaurant!.id)
      .is("revoked_at", null)
      .order("created_at")
      .limit(1)
      .single();
    expect(qrTokenError).toBeNull();
    expect(qrToken).not.toBeNull();

    const response = await page.goto(
      `${menuURL}/${encodeURIComponent(menuSlug)}/table/${encodeURIComponent(qrToken!.token)}`,
      { waitUntil: "domcontentloaded" },
    );
    expect(response?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute(
      "data-menu-hydrated",
      "true",
    );

    const simpleOpenButton = page
      .getByRole("button", { name: `${simpleItem!.name} detayını aç` })
      .first();
    await simpleOpenButton.click();
    const simpleDialog = page.getByRole("dialog").last();
    await simpleDialog.getByRole("button", { name: /sepete ekle/i }).click();
    const simpleCart = page.getByRole("dialog", { name: "Sepetiniz" });
    await expect(simpleCart).toContainText(simpleItem!.name);
    await simpleCart.getByRole("button", { name: "Sepeti kapat" }).click();

    const openButton = page
      .getByRole("button", { name: `${sourceItem!.name} detayını aç` })
      .first();
    await expect(openButton).toBeVisible();
    await openButton.click();
    const productDialog = page.getByRole("dialog").last();
    await expect(productDialog).toBeVisible();

    const addButton = productDialog.getByRole("button", {
      name: /sepete ekle/i,
    });
    await addButton.evaluate((element) => (element as HTMLButtonElement).click());
    await expect(productDialog.getByRole("alert")).toContainText(
      "zorunlu seçenekleri tamamlayın",
    );
    const invalidGroup = productDialog.locator(
      '[data-modifier-invalid="true"]',
    );
    await expect(invalidGroup).toBeFocused();

    await productDialog
      .getByRole("radio", { name: "Smoke standart seçim" })
      .check();
    await productDialog
      .getByRole("checkbox", { name: /Smoke sos olmasın/i })
      .check();
    await productDialog
      .getByRole("button", {
        name: `${recommendationItem!.name} ürününü yapılandır ve ekle`,
      })
      .click();
    const upsellDialog = page.getByRole("dialog", {
      name: recommendationItem!.name,
    });
    await expect(upsellDialog).toContainText("Ek ürün seçenekleri");
    await upsellDialog
      .getByRole("radio", { name: "Smoke upsell standart" })
      .check();
    await upsellDialog.getByRole("button", { name: "Seçimi kaydet" }).click();
    await expect(upsellDialog).toBeHidden();
    await productDialog
      .getByRole("textbox", { name: "Ürün notu" })
      .fill("SMOKE: sos ayrı gelsin");
    await addButton.click();

    const cart = page.getByRole("dialog", { name: "Sepetiniz" });
    await expect(cart).toBeVisible();
    await expect(cart).toContainText("Smoke standart seçim");
    await expect(cart).toContainText("Smoke upsell standart");
    await expect(cart).toContainText("ÇIKAR: Smoke sos");
    await expect(cart).toContainText("Not: SMOKE: sos ayrı gelsin");
    await expect(
      cart.getByText("Yanında iyi gider", { exact: true }),
    ).toBeVisible();

    const submitOrderButton = cart.getByRole("button", { name: /^Sipariş ver$/i });
    await page.route(
      "**/api/orders",
      async (route) => {
        await route.fulfill({
          status: 502,
          contentType: "text/plain",
          body: "Bad Gateway",
        });
      },
      { times: 1 },
    );
    await submitOrderButton.click();
    await expect(cart.getByRole("alert")).toContainText(
      "Sipariş şu anda işlenemiyor",
    );
    await expect(submitOrderButton).toBeEnabled();

    await page.route(
      "**/api/orders",
      async (route) => {
        await route.abort("internetdisconnected");
      },
      { times: 1 },
    );
    await submitOrderButton.click();
    await expect(cart.getByRole("alert")).toContainText(
      "Sipariş sunucuya ulaştırılamadı",
    );
    await expect(submitOrderButton).toBeEnabled();

    let postedBody = "";
    const orderResponsePromise = page.waitForResponse((candidate) => {
      if (
        !candidate.url().endsWith("/api/orders") ||
        candidate.request().method() !== "POST"
      )
        return false;
      postedBody = candidate.request().postData() ?? "";
      return true;
    });
    await submitOrderButton.click();
    const orderResponse = await orderResponsePromise;
    expect(orderResponse.status()).toBe(200);
    const payload = (await orderResponse.json()) as {
      success: boolean;
      data?: { orderId?: string };
      error?: string;
    };
    expect(payload.success, payload.error).toBe(true);
    expect(payload.data?.orderId).toMatch(/^[0-9a-f-]{36}$/i);
    fixtureState.createdOrderId = payload.data!.orderId!;
    await expect(
      page.getByText("Sipariş alındı", { exact: true }).first(),
    ).toBeVisible();

    const replay = await page.evaluate(async (body) => {
      const replayResponse = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      return {
        status: replayResponse.status,
        payload: await replayResponse.json(),
      };
    }, postedBody);
    expect(replay.status).toBe(200);
    expect(
      (replay.payload as { data?: { orderId?: string } }).data?.orderId,
    ).toBe(payload.data?.orderId);

    const { data: order, error: orderError } = await service
      .from("orders")
      .select("id, restaurant_id, table_id, source, status, total, items")
      .eq("id", payload.data!.orderId!)
      .single();
    expect(orderError).toBeNull();
    expect(order).toMatchObject({
      id: payload.data!.orderId,
      restaurant_id: restaurant!.id,
      table_id: qrToken!.table_id,
      source: "customer",
      status: "pending_approval",
    });
    const snapshot = order!.items as Array<{
      itemId: string;
      modifiers?: Array<{ optionId?: string }>;
      removedIngredients?: Array<{ id?: string }>;
      productNote?: string;
      recommendationSourceItemId?: string;
    }>;
    const mainLine = snapshot.find((line) => line.itemId === sourceItem!.id);
    const upsellLine = snapshot.find(
      (line) => line.itemId === recommendationItem!.id,
    );
    expect(mainLine?.modifiers?.[0]?.optionId).toBe("smoke-required-option");
    expect(mainLine?.removedIngredients?.[0]?.id).toBe(
      "smoke-removable-ingredient",
    );
    expect(mainLine?.productNote).toBe("SMOKE: sos ayrı gelsin");
    expect(upsellLine?.recommendationSourceItemId).toBe(sourceItem!.id);
    expect(upsellLine?.modifiers?.[0]?.optionId).toBe("smoke-upsell-option");
    expect(snapshot.some((line) => line.itemId === simpleItem!.id)).toBe(true);
    expect(Number(order!.total)).toBe(
      Number(sourceItem!.price) +
        Number(recommendationItem!.price) +
        Number(simpleItem!.price),
    );

    const { data: ownerResult, error: ownerError } =
      await service.auth.admin.getUserById(restaurant!.owner_id);
    expect(ownerError).toBeNull();
    expect(ownerResult.user.email).toBeTruthy();
    const { data: magicLink, error: magicLinkError } =
      await service.auth.admin.generateLink({
        type: "magiclink",
        email: ownerResult.user.email!,
      });
    expect(magicLinkError).toBeNull();
    const dashboardAuth = createClient();
    const { data: verifiedOwner, error: verifyOwnerError } =
      await dashboardAuth.auth.verifyOtp({
        token_hash: magicLink.properties.hashed_token,
        type: "email",
      });
    expect(verifyOwnerError).toBeNull();
    expect(verifiedOwner.session).not.toBeNull();
    await page.context().addCookies(
      dashboardSessionCookies(verifiedOwner.session),
    );

    const dashboardPage = await page.context().newPage();
    const dashboardResponse = await dashboardPage.goto(
      `${dashboardURL}/dashboard/${restaurant!.id}/orders`,
      { waitUntil: "domcontentloaded" },
    );
    expect(dashboardResponse?.status()).toBe(200);
    await expect(dashboardPage).toHaveURL(/\/orders$/);
    await expect(
      dashboardPage.getByText(`#${order!.id.slice(0, 6).toUpperCase()}`, {
        exact: true,
      }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      dashboardPage.getByText("Not: SMOKE: sos ayrı gelsin", { exact: true }),
    ).toBeVisible();
    await dashboardPage.close();

    const kitchenLaunch = await createKitchenLaunchTicket(restaurant!.id);
    expect(kitchenLaunch.kind).toBe("created");
    if (kitchenLaunch.kind !== "created") {
      throw new Error(`Kitchen launch failed: ${kitchenLaunch.kind}`);
    }
    const kitchenSessionResponse = await page.context().request.post(
      `${kitchenURL}/kitchen/${restaurant!.id}/session`,
      {
        form: { ticket: kitchenLaunch.ticket },
        maxRedirects: 0,
      },
    );
    expect(kitchenSessionResponse.status()).toBe(303);
    const kitchenPage = await page.context().newPage();
    const kitchenResponse = await kitchenPage.goto(
      `${kitchenURL}/kitchen/${restaurant!.id}`,
      { waitUntil: "domcontentloaded" },
    );
    expect(kitchenResponse?.status()).toBe(200);
    const kitchenCard = kitchenPage.locator(`[data-order-id="${order!.id}"]`);
    await expect(kitchenCard).toBeVisible({ timeout: 20_000 });
    await expect(kitchenCard).toContainText("Smoke standart seçim");
    await expect(kitchenCard).toContainText("ÇIKAR: Smoke sos");
    await expect(kitchenCard).toContainText("NOT: SMOKE: sos ayrı gelsin");
    await expect(kitchenCard).toContainText("Smoke upsell standart");
    await kitchenPage.close();
  });
});
