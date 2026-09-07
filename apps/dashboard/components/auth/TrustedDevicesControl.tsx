"use client";
import { forgetTrustedDevices } from "../../lib/actions/device-security";
import { AuthStatus, useAuthAction } from "./auth-form";
import { Button } from "../ui/button";
export default function TrustedDevicesControl() {
  const action = useAuthAction(forgetTrustedDevices);
  return (
    <form
      ref={action.ref}
      action={action.dispatch}
      onSubmit={action.onSubmit}
      className="space-y-3 p-4"
    >
      <p className="text-sm text-muted-foreground">
        Güven seçtiğin cihazlarda 15 gün boyunca e-posta kodunu tekrar girmen
        gerekmez. Ülke değişiminde yeniden doğrulama istenir.
      </p>
      <p className="text-sm text-muted-foreground">
        Güveni kaldırınca bu cihaz dahil tüm cihazlar tekrar e-posta kodu ister.
      </p>
      <AuthStatus state={action.state} />
      <Button type="submit" variant="outline" disabled={action.pending}>
        {action.pending ? "Güven kaldırılıyor…" : "Güvenilen cihazları unut"}
      </Button>
    </form>
  );
}
