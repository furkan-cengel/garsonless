"use client";
import { forgetTrustedDevices } from "../../lib/actions/device-security";
import { AuthStatus, useAuthAction } from "./auth-form";
import styles from "../../app/auth/login/login.module.css";
export default function TrustedDevicesControl() {
  const action = useAuthAction(forgetTrustedDevices);
  return (
    <form
      ref={action.ref}
      action={action.dispatch}
      onSubmit={action.onSubmit}
      className={styles.form}
      aria-busy={action.pending}
    >
      <header className={styles.formHeading}>
        <h1>Güvenilen cihazlar</h1>
      </header>
      <p className={styles.deviceDescription}>
        Güven seçtiğin cihazlarda 15 gün boyunca e-posta kodunu tekrar girmen
        gerekmez. Ülke değişiminde yeniden doğrulama istenir.
      </p>
      <p className={styles.deviceDescription}>
        Güveni kaldırınca bu cihaz dahil tüm cihazlar tekrar e-posta kodu ister.
      </p>
      <AuthStatus state={action.state} />
      <button type="submit" className={styles.primaryButton} disabled={action.pending}>
        {action.pending ? "Güven kaldırılıyor…" : "Güvenilen cihazları unut"}
      </button>
    </form>
  );
}
