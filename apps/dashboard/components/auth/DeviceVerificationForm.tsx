"use client";
import Link from "next/link";
import {
  sendDeviceCode,
  verifyDeviceCode,
} from "../../lib/actions/device-security";
import {
  useAuthAction,
  useResendCountdown,
  AuthField,
  AuthStatus,
} from "./auth-form";
import styles from "../../app/auth/login/login.module.css";
export default function DeviceVerificationForm({
  email,
  next,
  reason,
  hasCode = false,
  initialRetryAfter = 0,
}: {
  email: string;
  next: string;
  reason: string;
  hasCode?: boolean;
  initialRetryAfter?: number;
}) {
  const send = useAuthAction(sendDeviceCode);
  const verify = useAuthAction(verifyDeviceCode);
  const remaining = useResendCountdown(send.state, initialRetryAfter);
  const busy = send.pending || verify.pending;
  const sent = send.state?.success || hasCode;
  return (
    <div className={styles.formWrap}>
      <header className={styles.formHeading}>
        <h1>
          Girişini doğrula<span className={styles.period}>.</span>
        </h1>
        <p>{reason}</p>
      </header>
      <p className={styles.legalNotice}>
        Doğrulama adresin: <strong>{email}</strong>
      </p>
      <form
        ref={verify.ref}
        onSubmit={verify.onSubmit}
        action={verify.dispatch}
        className={styles.form}
        aria-busy={busy}
      >
        <input type="hidden" name="next" value={next} />
        {sent && (
          <>
            <div className={styles.successPanel} role="status">
              Kod gönderildi. Gelen kutunu ve spam klasörünü kontrol et.
            </div>
            <AuthField
              label="Doğrulama kodu"
              name="code"
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              minLength={6}
              required
              error={verify.state?.fieldErrors?.code}
            />
            <label className={styles.termsLabel}>
              <input type="checkbox" name="trustDevice" />
              <span>Bu cihaza 15 gün güven</span>
            </label>
            <p className={styles.legalNotice}>
              Yalnız kişisel cihazında seç. Ülke veya bağlantı riski değişirse
              yeniden doğrulama istenebilir.
            </p>
            <AuthStatus state={verify.state} />
            <button className={styles.primaryButton} disabled={busy}>
              {verify.pending ? "Doğrulanıyor…" : "Doğrula ve devam et"}
            </button>
          </>
        )}
      </form>
      <form
        ref={send.ref}
        onSubmit={send.onSubmit}
        action={send.dispatch}
        className={styles.form}
      >
        <AuthStatus state={send.state} />
        <button
          className={sent ? styles.backButton : styles.primaryButton}
          disabled={busy || remaining > 0}
        >
          {send.pending
            ? "Kod gönderiliyor…"
            : remaining > 0
              ? "Yeniden gönder (" + remaining + " sn)"
              : sent
                ? "Yeni kod gönder"
                : "E-postama kod gönder"}
        </button>
      </form>
      <Link
        className={styles.backButton}
        href={"/auth/login?" + new URLSearchParams({ next }).toString()}
      >
        Başka hesapla giriş yap
      </Link>
    </div>
  );
}
