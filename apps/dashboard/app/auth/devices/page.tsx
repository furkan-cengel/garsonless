import { redirect } from "next/navigation";
import AuthShell from "../../../components/auth/AuthShell";
import TrustedDevicesControl from "../../../components/auth/TrustedDevicesControl";
import { createDashboardServerClient } from "../../../lib/supabase-server";
import { deviceSecurityEnabled } from "../../../lib/auth/device-session";
export const dynamic = "force-dynamic";
export default async function DevicesPage() {
  if (!deviceSecurityEnabled())
    return (
      <AuthShell>
        <h1>Cihaz güvenliği</h1>
        <p>Cihaz doğrulaması bu ortamda henüz etkinleştirilmedi.</p>
      </AuthShell>
    );
  const {
    data: { user },
  } = await (await createDashboardServerClient()).auth.getUser();
  if (!user) redirect("/auth/login?next=/auth/devices");
  return (
    <AuthShell>
      <h1>Güvenilen cihazlar</h1>
      <TrustedDevicesControl />
    </AuthShell>
  );
}
