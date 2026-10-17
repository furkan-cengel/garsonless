import { notFound } from "next/navigation";
import { listTeamMembers, readSadakatDashboard } from "@garsonless/db/server";
import { validSadakatId } from "@garsonless/application/sadakat";
import { getDashboardRequestAuth } from "../../../lib/auth/current-user";
import SadakatDashboardClient from "../../../components/sadakat/SadakatDashboardClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Masabu Sadakat" };
export default async function SadakatDashboardPage({
  params,
}: {
  params: Promise<{ restaurantId: string }>;
}) {
  const { restaurantId } = await params;
  if (!validSadakatId(restaurantId)) notFound();
  const { user } = await getDashboardRequestAuth();
  const dashboard = await readSadakatDashboard(restaurantId, user.id).catch(
    (error) => {
      if (error instanceof Error && error.message === "SADAKAT_FORBIDDEN")
        notFound();
      throw error;
    },
  );
  const team = dashboard.isOwner
    ? (await listTeamMembers(restaurantId)).filter((member) =>
        member.permissions.includes("sadakat"),
      )
    : [];
  return (
    <SadakatDashboardClient
      dashboard={dashboard}
      team={team}
      menuBase={process.env.NEXT_PUBLIC_MENU_URL ?? "http://localhost:3011"}
    />
  );
}
