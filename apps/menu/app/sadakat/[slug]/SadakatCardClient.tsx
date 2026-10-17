"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  sadakatProgress,
  type SadakatCard,
  type SadakatProgram,
} from "@garsonless/domain/sadakat";
import SadakatCaptcha from "../../../components/SadakatCaptcha";
import styles from "./sadakat.module.css";

type Code = { code: string; expiresAt: string; qr: string };
const authErrors: Record<string, string> = {
  PHONE_INVALID: "Geçerli bir cep telefonu numarası yaz.",
  OTP_INVALID: "E-posta kodunu kontrol et.",
  OTP_EXPIRED: "E-posta kodunun süresi doldu. Yeniden kod iste.",
  PROVIDER_DISABLED: "E-posta ile giriş şu anda kullanılamıyor.",
  RATE_LIMITED: "Çok fazla deneme. Biraz sonra tekrar dene.",
  CHALLENGE_REQUIRED: "Güvenlik kontrolü gerekiyor. Biraz sonra yeniden dene.",
  IDENTITY_CONFLICT: "Hesabını bağlamak için destekle iletişime geç.",
  STAFF_ACCOUNT_REJECTED:
    "Bu e-posta personel hesabına bağlı. Müşteri e-postanı kullan.",
  PLAN_REQUIRED: "İşletmenin pilot erişimi aktif değil.",
};
async function send<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      typeof data.error === "string"
        ? data.error
        : (authErrors[data.error?.code] ??
            "İşlem tamamlanamadı. Bağlantını kontrol edip tekrar dene."),
    );
  return data as T;
}
export default function SadakatCardClient({
  program,
  initialCard,
  authenticated,
  contactVerified,
  emailEnabled,
}: {
  program: SadakatProgram;
  initialCard: SadakatCard | null;
  authenticated: boolean;
  contactVerified: boolean;
  emailEnabled: boolean;
}) {
  const [card, setCard] = useState(initialCard);
  const [signedIn, setSignedIn] = useState(authenticated && contactVerified);
  const [name, setName] = useState("");
  const hasCard = Boolean(card);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [intent, setIntent] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState<Code | null>(null);
  const [now, setNow] = useState(Date.now());
  const [captcha, setCaptcha] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [resendAt, setResendAt] = useState(0);
  const endpoint = `/api/sadakat/${encodeURIComponent(program.slug)}`;
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!hasCard) return;
    const refresh = async () => {
      try {
        const res = await fetch(endpoint, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data.card) setCard(data.card);
        }
      } catch {
        /* Existing card remains visible. */
      }
    };
    const timer = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 10000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [endpoint, hasCard]);
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tekrar dene.");
      if (e instanceof Error && e.message === authErrors.CHALLENGE_REQUIRED)
        setCaptcha(true);
    } finally {
      setBusy(false);
    }
  };
  const join = async () => {
    const result = await send<{ card: SadakatCard }>(endpoint, {
      action: "join",
      consent: true,
    });
    setCard(result.card);
  };
  const progress = sadakatProgress(card?.stamps ?? 0, program.goal);
  const seconds = code
    ? Math.max(0, Math.ceil((Date.parse(code.expiresAt) - now) / 1000))
    : 0;
  return (
    <main className={styles.page}>
      <div className={styles.brand}>
        masabu <span>sadakat</span>
      </div>
      <section
        className={styles.card}
        style={{ borderTopColor: program.color }}
      >
        {program.logoUrl && (
          <Image
            unoptimized
            className={styles.logo}
            src={program.logoUrl}
            width={64}
            height={64}
            alt=""
          />
        )}
        <p className={styles.eyebrow}>SENİN SADAKAT KARTIN</p>
        <h1>{program.name}</h1>
        <p>
          {program.goal} damgaya <strong>{program.reward}</strong>
        </p>
        <div
          className={styles.stamps}
          aria-label={`${card?.stamps ?? 0} damga`}
        >
          {Array.from({ length: program.goal }, (_, i) => (
            <span
              key={i}
              className={i < progress.progress ? styles.filled : ""}
              style={
                i < progress.progress
                  ? { background: program.color }
                  : undefined
              }
            >
              {i < progress.progress ? "✓" : i + 1}
            </span>
          ))}
        </div>
        <h2>
          {progress.rewards > 0
            ? `${progress.rewards} ödülün hazır 🎉`
            : `${progress.remaining} damga sonra ödül senin`}
        </h2>
        <p className={styles.muted}>
          Damga kazandıran ürünler: {program.eligibleProducts}
        </p>
      </section>
      {!program.active && (
        <p className={styles.notice}>
          İşletmenin pilot erişimi aktif değil. Kartın ve geçmişin korunuyor.
        </p>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {!card && (
        <section className={styles.panel}>
          <h2>
            {program.active ? "Kartını oluştur" : "Mevcut kartına giriş yap"}
          </h2>
          <p>
            Bir kez katıl, her alışverişte kartını göster. E-postana gelen kodla
            güvenle giriş yap.
          </p>
          {program.active && (
            <label className={styles.consent}>
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />{" "}
              <span>
                Sadakat programına katılmayı ve iletişim bilgilerimin kartımı
                yönetmek için işletmeyle paylaşılmasını kabul ediyorum.{" "}
                <a
                  href="https://masabu.co/yasal/kvkk-aydinlatma-metni"
                  target="_blank"
                  rel="noreferrer"
                >
                  Gizlilik açıklaması
                </a>
              </span>
            </label>
          )}
          {!signedIn ? (
            <form
              className={styles.form}
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  if (intent) {
                    await send("/api/customer-auth/email/verify", {
                      intent,
                      code: otp,
                    });
                    setSignedIn(true);
                    if (program.active) await join();
                    else {
                      const response = await fetch(endpoint, {
                        cache: "no-store",
                      });
                      const data = await response.json();
                      if (!data.card)
                        throw new Error("Mevcut kart bulunamadı.");
                      setCard(data.card);
                    }
                  } else {
                    const result = await send<{
                      data: { intent: string; resendAfterSeconds: number };
                    }>("/api/customer-auth/email/start", {
                      email,
                      restaurantId: program.restaurantId,
                      restaurantSlug: program.slug,
                      name: name || undefined,
                      surface: "sadakat",
                      returnPath: `/sadakat/${program.slug}`,
                      consent: false,
                      marketingConsent: false,
                      captchaToken: captchaToken || undefined,
                    });
                    setIntent(result.data.intent);
                    setResendAt(
                      Date.now() + result.data.resendAfterSeconds * 1000,
                    );
                  }
                });
              }}
            >
              {!intent && program.active && (
                <>
                  <label htmlFor="customer-name">Adın (isteğe bağlı)</label>
                  <input
                    id="customer-name"
                    autoComplete="given-name"
                    maxLength={80}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </>
              )}
              <label htmlFor="email">E-posta adresin</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="adın@ornek.com"
                maxLength={254}
                required
                value={email}
                disabled={Boolean(intent)}
                onChange={(e) => setEmail(e.target.value)}
              />
              {intent && (
                <>
                  <label htmlFor="otp">E-posta doğrulama kodu</label>
                  <input
                    id="otp"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                  />
                  <p className={styles.muted}>
                    E-posta gecikirse spam klasörünü de kontrol et. Yeniden
                    gönderme {Math.max(0, Math.ceil((resendAt - now) / 1000))}{" "}
                    saniye sonra açılır.
                  </p>
                  <button
                    type="button"
                    className={styles.secondary}
                    disabled={busy || now < resendAt}
                    onClick={() => {
                      setIntent(null);
                      setOtp("");
                    }}
                  >
                    E-postayı değiştir / yeni kod iste
                  </button>
                </>
              )}
              {captcha && <SadakatCaptcha onToken={setCaptchaToken} />}
              <button
                disabled={busy || (program.active && !consent) || !emailEnabled}
              >
                {busy
                  ? "İşleniyor…"
                  : intent
                    ? program.active
                      ? "Doğrula ve kartımı oluştur"
                      : "Kartıma giriş yap"
                    : "E-posta ile devam et"}
              </button>
              {!emailEnabled && (
                <p role="status">E-posta ile katılım şu anda kullanılamıyor.</p>
              )}
            </form>
          ) : (
            <button disabled={busy || !consent} onClick={() => void run(join)}>
              Kartımı oluştur
            </button>
          )}
        </section>
      )}
      {card && (
        <section className={styles.panel}>
          <button
            disabled={busy || !program.active}
            onClick={() =>
              void run(async () =>
                setCode(await send<Code>(endpoint, { action: "code" })),
              )
            }
          >
            Kasada göster
          </button>
          {code && (
            <div className={styles.code}>
              {seconds > 0 ? (
                <>
                  <Image
                    unoptimized
                    src={code.qr}
                    width={240}
                    height={240}
                    alt="Personele gösterilecek kişisel QR kod"
                  />
                  <strong>{code.code.match(/.{1,4}/g)?.join(" ")}</strong>
                  <p>
                    {seconds} saniye geçerli · Damga ve ödül işlemini personel
                    onaylar.
                  </p>
                </>
              ) : (
                <p>Kodun süresi doldu. “Kasada göster” ile yeni kod aç.</p>
              )}
            </div>
          )}
          <details>
            <summary>Ana ekranına ekle</summary>
            <p>
              iPhone’da Safari → Paylaş → Ana Ekrana Ekle. Android’de tarayıcı
              menüsü → Ana ekrana ekle. Bağlantıyı kaybedersen işletmenin QR’ını
              yeniden okut.
            </p>
          </details>
          <h2>İşlem geçmişin</h2>
          {card.history.length === 0 ? (
            <p>İlk damganı kasada alabilirsin.</p>
          ) : (
            <ul className={styles.history}>
              {card.history.map((item) => (
                <li key={item.id}>
                  <span>
                    {item.direction === "redeem"
                      ? "Ödül kullanımı"
                      : item.direction === "reversal"
                        ? "İşlem düzeltmesi"
                        : "Damga"}
                    <small>
                      {new Date(item.createdAt).toLocaleString("tr-TR", {
                        timeZone: "Europe/Istanbul",
                      })}
                    </small>
                  </span>
                  <strong>
                    {item.delta > 0 ? "+" : ""}
                    {item.delta}
                  </strong>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {(card || signedIn) && (
        <button
          className={styles.secondary}
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await send("/api/account/logout", { scope: "device" });
              setCard(null);
              setSignedIn(false);
              setCode(null);
              setIntent(null);
              setConsent(false);
            })
          }
        >
          Bu cihazda çıkış yap
        </button>
      )}
      <footer className={styles.footer}>
        Masabu Sadakat ile hazırlanmıştır.
      </footer>
    </main>
  );
}
