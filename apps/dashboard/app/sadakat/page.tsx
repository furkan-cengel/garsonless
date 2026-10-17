import Link from "next/link";
import { getRestaurantsForUser } from "../../lib/queries/restaurants";
import { getDashboardRequestAuth } from "../../lib/auth/current-user";
import { getUserRestaurantAccess } from "../../lib/auth/access";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export default async function SadakatIndex() {
  await getDashboardRequestAuth();
  const restaurants = await getRestaurantsForUser();
  const entries = await Promise.all(
    restaurants.map(async (restaurant) => ({
      restaurant,
      access: await getUserRestaurantAccess(restaurant.id),
    })),
  );
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <h1 className="text-3xl font-semibold">Masabu Sadakat</h1>
      <p className="text-muted-foreground">
        İşletmeni seç, sadakat kartını yönet.
      </p>
      {entries
        .filter(
          (entry) =>
            entry.access?.isOwner ||
            entry.access?.permissions.includes("sadakat"),
        )
        .map(({ restaurant }) => (
          <Link
            key={restaurant.id}
            className={buttonVariants({ variant: "outline" })}
            href={`/sadakat/${restaurant.id}`}
          >
            {restaurant.name}
          </Link>
        ))}
      <Link
        className={buttonVariants({ variant: "secondary" })}
        href="/sadakat/kurulum"
      >
        Yeni işletme oluştur
      </Link>
    </main>
  );
}
