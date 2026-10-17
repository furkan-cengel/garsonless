import { z } from "zod";
import QRCode from "qrcode";
import {
  createCustomerConsentApplicationPort,
  issueSadakatCode,
  joinSadakat,
  readSadakatCard,
  readSadakatProgram,
  sadakatError,
} from "@garsonless/db/server";
import { getCustomerSession } from "../../../../lib/customer-session";
import { validateCustomerAuthMutation } from "../../../../lib/customer-auth-request";
import { enforceCustomerAuthRateLimit } from "../../../../lib/customer-auth-server";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("join"), consent: z.literal(true) }),
  z.object({ action: z.literal("code") }),
]);
const reply = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
type Context = { params: Promise<{ slug: string }> };
export async function GET(_request: Request, context: Context) {
  try {
    const program = await readSadakatProgram((await context.params).slug);
    if (!program) return reply({ error: "Kart bulunamadı." }, 404);
    const session = await getCustomerSession();
    return reply({
      program,
      card: session
        ? await readSadakatCard(program.restaurantId, session.customerId)
        : null,
      authenticated: Boolean(session),
      contactVerified:
        session?.emailVerified === true || session?.phoneVerified === true,
    });
  } catch {
    return reply({ error: "Kart yüklenemedi. Tekrar dene." }, 503);
  }
}
export async function POST(request: Request, context: Context) {
  if (!validateCustomerAuthMutation(request).ok)
    return reply({ error: "Oturum doğrulanamadı." }, 403);
  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success) return reply({ error: "Bilgileri kontrol et." }, 400);
  const session = await getCustomerSession();
  if (!session) return reply({ error: "Önce e-postanla giriş yap." }, 401);
  try {
    const program = await readSadakatProgram((await context.params).slug);
    if (!program) return reply({ error: "Kart bulunamadı." }, 404);
    if (!program.active)
      return reply(
        { error: "Pilot şu anda aktif değil. Kartın ve geçmişin korunuyor." },
        403,
      );
    const limited = await enforceCustomerAuthRateLimit({
      request,
      bucket: "sadakat-customer",
      subject: session.customerId,
      limit: 30,
      windowSeconds: 600,
    });
    if (!limited.ok)
      return reply({ error: "Çok fazla istek. Biraz sonra tekrar dene." }, 429);
    if (input.data.action === "join") {
      if (!session.emailVerified && !session.phoneVerified)
        return reply({ error: "E-postanı doğrula." }, 403);
      const consent =
        await createCustomerConsentApplicationPort().recordConsent({
          customerId: session.customerId,
          restaurantId: program.restaurantId,
          consentType: "contact_data",
          grant: true,
          source: "join",
        });
      if (!consent.ok)
        return reply({ error: "Katılım kaydedilemedi. Tekrar dene." }, 503);
      const card = await joinSadakat(program.restaurantId, session.customerId);
      console.info(
        JSON.stringify({
          event: "sadakat.join",
          restaurantId: program.restaurantId,
          result: "success",
        }),
      );
      return reply({ card });
    }
    const code = await issueSadakatCode(
      program.restaurantId,
      session.customerId,
    );
    return reply({
      ...code,
      qr: await QRCode.toDataURL(code.code, {
        margin: 2,
        width: 280,
        errorCorrectionLevel: "M",
      }),
    });
  } catch (error) {
    return reply({ error: sadakatError(error) }, 409);
  }
}
