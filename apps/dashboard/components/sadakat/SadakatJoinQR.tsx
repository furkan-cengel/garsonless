"use client";
import { useEffect, useRef, useState } from "react";
export default function SadakatJoinQR({ url }: { url: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void import("qr-code-styling")
      .then(({ default: QR }) => {
        if (cancelled || !container.current) return;
        container.current.replaceChildren();
        new QR({
          width: 180,
          height: 180,
          data: url,
          margin: 8,
          qrOptions: { errorCorrectionLevel: "M" },
        }).append(container.current);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);
  return (
    <div className="flex flex-col items-center gap-2">
      <div ref={container} role="img" aria-label="Müşteri katılım QR kodu" />
      {error && <p>QR yüklenemedi. Bağlantıyı kullanabilirsin.</p>}
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="break-all text-sm underline"
      >
        {url}
      </a>
    </div>
  );
}
