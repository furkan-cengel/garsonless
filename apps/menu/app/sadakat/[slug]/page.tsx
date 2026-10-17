import { notFound } from "next/navigation";
import { readSadakatCard, readSadakatProgram } from "@garsonless/db/server";
import { getCustomerSession } from "../../../lib/customer-session";
import { availableCustomerAuthCapabilities } from "../../../lib/customer-auth-provider";
import SadakatCardClient from "./SadakatCardClient";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Sadakat kartın | Masabu",
  robots: { index: false, follow: false },
};
export default async function SadakatPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const program = await readSadakatProgram(slug);
  if (!program) notFound();
  const [session, capabilities] = await Promise.all([
    getCustomerSession(),
    availableCustomerAuthCapabilities(),
  ]);
  const card = session
    ? await readSadakatCard(program.restaurantId, session.customerId)
    : null;
  return (
    <SadakatCardClient
      program={program}
      initialCard={card}
      authenticated={Boolean(session)}
      contactVerified={
        session?.emailVerified === true || session?.phoneVerified === true
      }
      emailEnabled={capabilities.emailOtp}
    />
  );
}
