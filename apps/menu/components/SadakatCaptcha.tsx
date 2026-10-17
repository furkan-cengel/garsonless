"use client";
import { useEffect, useRef, useState } from "react";
import Script from "next/script";
export default function SadakatCaptcha({
  onToken,
}: {
  onToken: (token: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    widget = useRef<number | null>(null);
  const callback = useRef(onToken);
  callback.current = onToken;
  const [ready, setReady] = useState(false);
  const siteKey =
    process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ||
    (process.env.NODE_ENV === "development"
      ? "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"
      : "");
  useEffect(() => {
    if (
      !ready ||
      !siteKey ||
      !host.current ||
      widget.current !== null ||
      !window.grecaptcha
    )
      return;
    widget.current = window.grecaptcha.render(host.current, {
      sitekey: siteKey,
      size: "compact",
      callback: (token) => callback.current(token),
      "expired-callback": () => callback.current(""),
    });
  }, [ready, siteKey]);
  return (
    <div aria-label="Güvenlik doğrulaması">
      <Script
        id="masabu-customer-auth-recaptcha"
        src="https://www.google.com/recaptcha/api.js?render=explicit&hl=tr"
        strategy="afterInteractive"
        onReady={() => setReady(true)}
      />
      {siteKey ? (
        <div ref={host} />
      ) : (
        <p>Güvenlik doğrulaması şu anda kullanılamıyor.</p>
      )}
    </div>
  );
}
