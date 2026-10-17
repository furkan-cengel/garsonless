"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export default function SadakatScanner({
  onCode,
}: {
  onCode: (code: string) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const callback = useRef(onCode);
  callback.current = onCode;
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!enabled) return;
    const element = video.current;
    let stopped = false;
    let controls: { stop(): void } | undefined;
    const start = async () => {
      try {
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        if (stopped || !element) return;
        const reader = new BrowserQRCodeReader();
        const scan = await reader.decodeFromConstraints(
          { video: { facingMode: "environment" } },
          element,
          (result) => {
            if (result && !stopped) {
              stopped = true;
              controls?.stop();
              callback.current(result.getText());
              setEnabled(false);
            }
          },
        );
        controls = scan;
        if (stopped) scan.stop();
      } catch {
        if (!stopped) {
          setError(
            "Kamera açılamadı. İzinleri kontrol et veya müşterinin kodunu elle yaz.",
          );
          setEnabled(false);
        }
      }
    };
    void start();
    return () => {
      stopped = true;
      controls?.stop();
      const stream = element?.srcObject;
      if (stream instanceof MediaStream)
        stream.getTracks().forEach((track) => track.stop());
    };
  }, [enabled]);
  return (
    <div className="flex flex-col gap-3">
      <Button
        variant="outline"
        onClick={() => {
          setError("");
          setEnabled(!enabled);
        }}
      >
        {enabled ? "Kamerayı kapat" : "Kamerayla QR okut"}
      </Button>
      {enabled && (
        <video
          ref={video}
          className="aspect-square w-full rounded-xl object-cover"
          muted
          playsInline
          aria-label="QR tarayıcı"
        />
      )}
      {error && (
        <p role="alert" className="text-sm text-muted-foreground">
          {error}
        </p>
      )}
    </div>
  );
}
