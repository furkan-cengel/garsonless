import { requireSection } from "../../../../../lib/auth/access";
import { menuTranslationAction } from "../../../../../lib/actions/menu-translation";
import MenuTranslations from "../../../../../components/menu-translations/MenuTranslations";
export default async function MenuTranslationsPage({
  params,
}: {
  params: Promise<{ restaurantId: string }>;
}) {
  const { restaurantId } = await params;
  await requireSection(restaurantId, "menu");
  const result = await menuTranslationAction({
    restaurantId,
    mode: "snapshot",
  });
  return (
    <MenuTranslations
      restaurantId={restaurantId}
      initial={result.ok ? result.data : null}
      initialError={result.ok ? undefined : result.error}
    />
  );
}
