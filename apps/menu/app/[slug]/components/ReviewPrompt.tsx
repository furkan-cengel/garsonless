"use client";
import { useEffect, useRef, useState } from "react";
import { CUSTOMER_FEEDBACK_COMMENT_MAX_LENGTH, isLowCustomerRating, type CustomerReviewPrompt } from "@garsonless/domain/customers";
import { AppIcons as I } from "@garsonless/ui/icons";
import type { ApiResult } from "../../../lib/customer-auth-contract";

type Step = "ask" | "high" | "low" | "sent";

/** Longest wait an open menu keeps for a prompt that is not due yet. */
const MAX_WAIT_MS = 25 * 60 * 1000;

/**
 * Asks a signed-in customer about their visit 20 minutes after payment. Every
 * rating gets the Google link; 1-3 stars can also write to the business.
 */
export function ReviewPrompt({ restaurantId, restaurantName, enabled }: { restaurantId: string; restaurantName: string; enabled: boolean }) {
  const [prompt, setPrompt] = useState<CustomerReviewPrompt | null>(null);
  const [due, setDue] = useState(false);
  const [step, setStep] = useState<Step>("ask");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitted = useRef(false);
  const firstStar = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    fetch(`/api/account/review?restaurantId=${encodeURIComponent(restaurantId)}`)
      .then((response) => response.json() as Promise<ApiResult<{ prompt: CustomerReviewPrompt | null }>>)
      .then((result) => {
        if (!live || !result.ok || !result.data.prompt) return;
        const wait = new Date(result.data.prompt.availableAt).getTime() - Date.now();
        if (wait > MAX_WAIT_MS) return;
        setPrompt(result.data.prompt);
        if (wait <= 0) setDue(true);
        else timer = setTimeout(() => setDue(true), wait + 2000);
      })
      .catch(() => {});
    return () => { live = false; if (timer) clearTimeout(timer); };
  }, [enabled, restaurantId]);

  useEffect(() => {
    if (due && step === "ask") firstStar.current?.focus({ preventScroll: true });
  }, [due, step]);

  if (!enabled || !prompt || !due) return null;
  const visitKey = prompt.visitKey;

  async function send(value: number | null, note: string | null): Promise<boolean> {
    const response = await fetch("/api/account/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId, visitKey, rating: value, comment: note }),
    }).catch(() => null);
    return Boolean(response?.ok);
  }

  function close() {
    // Leaving without a rating counts as "not now"; leaving after one keeps the stars.
    if (!submitted.current) void send(rating || null, null);
    submitted.current = true;
    setPrompt(null);
  }

  function rate(value: number) {
    setRating(value);
    if (isLowCustomerRating(value)) {
      setStep("low");
      return;
    }
    submitted.current = true;
    void send(value, null);
    setStep("high");
  }

  async function sendComment() {
    setBusy(true);
    setError(null);
    const ok = await send(rating, comment.trim() || null);
    setBusy(false);
    if (!ok) { setError("Gönderilemedi. Tekrar dene."); return; }
    submitted.current = true;
    setStep("sent");
  }

  function openGoogle() {
    if (!submitted.current) void send(rating || null, step === "low" ? comment.trim() || null : null);
    submitted.current = true;
  }

  const title = step === "ask" ? "Ziyaretin nasıldı?"
    : step === "high" ? "Teşekkürler! Çok sevindik"
    : step === "low" ? "Üzgünüz, ne oldu?"
    : "Teşekkürler, işletmeye ilettik";
  const body = step === "ask" ? "Bir dokunuşla puanla. 10 saniye sürer."
    : step === "high" ? "Deneyimini Google’da paylaşırsan yeni misafirler bizi daha kolay bulur."
    : step === "low" ? "Bize anlat; işletme sahibi doğrudan okur. İstersen Google’da da yazabilirsin."
    : "Notun yalnızca işletmeye gider.";
  const googleLink = prompt.googleUrl && step !== "ask"
    ? <a href={prompt.googleUrl} target="_blank" rel="noopener noreferrer" onClick={openGoogle} style={step === "high" ? primaryStyle : secondaryStyle}>Google’da yorum yaz</a>
    : null;

  return (
    <section
      data-component="review-prompt"
      role="dialog"
      aria-labelledby="review-prompt-title"
      aria-describedby="review-prompt-body"
      style={{
        position: "fixed",
        left: 12,
        right: 12,
        bottom: "calc(12px + env(safe-area-inset-bottom))",
        zIndex: 70,
        maxWidth: 440,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: 16,
        borderRadius: 18,
        border: "1px solid var(--p-border)",
        background: "var(--p-card)",
        color: "var(--p-text)",
        boxShadow: "0 16px 40px rgba(0,0,0,.22)",
        fontFamily: "var(--p-body)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 11, color: "var(--p-text-2)" }}>{restaurantName}</span>
          <h2 id="review-prompt-title" style={{ margin: "2px 0 0", fontSize: 16, fontFamily: "var(--p-display)" }}>{title}</h2>
          <p id="review-prompt-body" style={{ margin: "4px 0 0", fontSize: 13, lineHeight: 1.45, color: "var(--p-text-2)" }}>{body}</p>
        </div>
        <button type="button" onClick={close} aria-label="Kapat" style={{ minWidth: 44, minHeight: 44, margin: -8, border: 0, background: "transparent", color: "var(--p-text-2)", cursor: "pointer", display: "grid", placeItems: "center" }}>
          <I.close size={18} />
        </button>
      </div>

      {step !== "sent" && (
        <div role="group" aria-label="Puan" style={{ display: "flex", justifyContent: "center", gap: 4 }}>
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              ref={value === 1 ? firstStar : undefined}
              type="button"
              aria-label={`${value} yıldız`}
              aria-pressed={rating === value}
              disabled={step === "high"}
              onClick={() => rate(value)}
              style={{ minWidth: 48, minHeight: 48, border: 0, background: "transparent", cursor: step === "high" ? "default" : "pointer", fontSize: 30, lineHeight: 1, color: value <= rating ? "#e9b949" : "var(--p-border)" }}
            >
              ★
            </button>
          ))}
        </div>
      )}

      {step === "low" && (
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 650 }}>
          Ne oldu? (isteğe bağlı)
          <textarea
            value={comment}
            maxLength={CUSTOMER_FEEDBACK_COMMENT_MAX_LENGTH}
            rows={3}
            onChange={(event) => setComment(event.target.value)}
            style={{ resize: "vertical", minHeight: 76, borderRadius: 12, border: "1.5px solid var(--p-border)", padding: 10, background: "var(--p-bg)", color: "var(--p-text)", font: "500 14px var(--p-body)" }}
          />
        </label>
      )}
      {error && <p role="alert" style={{ margin: 0, fontSize: 12, color: "#a7372d" }}>{error}</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {step === "ask" && <button type="button" onClick={close} style={secondaryStyle}>Şimdi değil</button>}
        {step === "low" && <button type="button" onClick={() => void sendComment()} disabled={busy} style={primaryStyle}>{busy ? "Gönderiliyor…" : "İşletmeye gönder"}</button>}
        {googleLink}
        {(step === "high" || step === "sent") && <button type="button" onClick={close} style={secondaryStyle}>{step === "high" ? "Belki sonra" : "Kapat"}</button>}
      </div>
    </section>
  );
}

const buttonBase = {
  minHeight: 46,
  borderRadius: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  font: "700 13px var(--p-body)",
  textDecoration: "none",
  cursor: "pointer",
} as const;
const primaryStyle = { ...buttonBase, border: 0, background: "var(--p-cta)", color: "var(--p-cta-text)" };
const secondaryStyle = { ...buttonBase, border: "1px solid var(--p-border)", background: "transparent", color: "var(--p-text)" };
