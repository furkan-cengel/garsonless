"use client";

import { useEffect, useId, useRef, useState } from "react";
import Check from "lucide-react/dist/esm/icons/check.mjs";
import Copy from "lucide-react/dist/esm/icons/copy.mjs";
import House from "lucide-react/dist/esm/icons/house.mjs";
import Info from "lucide-react/dist/esm/icons/info.mjs";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw.mjs";
import TriangleAlert from "lucide-react/dist/esm/icons/triangle-alert.mjs";
import { MASABU_LOGO_DATA_URI } from "./masabu-logo-data";
export { MASABU_LOGO_DATA_URI } from "./masabu-logo-data";

type ClipboardWriter = Pick<Clipboard, "writeText">;

export type RecoveryScreenProps = {
  kind: "error" | "not-found";
  title: string;
  description: string;
  code: string;
  homeHref: string;
  homeLabel: string;
  retryLabel?: string;
  onRetry?: () => void | Promise<void>;
  appearance?: "light" | "dark";
  statusHref?: string;
};

export function getSafeStatusHref(value?: string): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function copyRecoveryCode(
  code: string,
  clipboard?: ClipboardWriter,
): Promise<"copied" | "failed"> {
  if (!clipboard) return "failed";

  try {
    await clipboard.writeText(code);
    return "copied";
  } catch {
    return "failed";
  }
}

const recoveryStyles = `
  .mas-recovery-page,
  .mas-recovery-page *,
  .mas-recovery-page *::before,
  .mas-recovery-page *::after {
    box-sizing: border-box;
  }

  .mas-recovery-page {
    --recovery-page: #f6f6f7;
    --recovery-card: #ffffff;
    --recovery-surface-2: #fafafa;
    --recovery-surface-3: #f3f3f4;
    --recovery-border: #e7e7ea;
    --recovery-border-strong: #d6d7db;
    --recovery-divider: #efeff1;
    --recovery-text: #111113;
    --recovery-text-2: #5b5d63;
    --recovery-text-3: #8b8d94;
    --recovery-action: #18181b;
    --recovery-action-hover: #2f3034;
    --recovery-on-action: #ffffff;
    --recovery-positive: #137a4d;
    --recovery-positive-bg: #e6f4ec;
    --recovery-warning: #a55a00;
    --recovery-warning-bg: #fef3e2;
    --recovery-accent-soft: #eaf3ed;
    position: relative;
    isolation: isolate;
    display: grid;
    grid-template-columns: minmax(0, 520px);
    justify-content: center;
    min-height: 100vh;
    min-height: 100dvh;
    width: 100%;
    place-items: center;
    overflow: hidden;
    padding: 40px 20px;
    color: var(--recovery-text);
    background: var(--recovery-page);
    font-family: Geist, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  .mas-recovery-page[data-appearance='dark'] {
    --recovery-page: #111315;
    --recovery-card: #1b1e21;
    --recovery-surface-2: #202428;
    --recovery-surface-3: #292e33;
    --recovery-border: #30363c;
    --recovery-border-strong: #444c54;
    --recovery-divider: #30363c;
    --recovery-text: #f6f7f8;
    --recovery-text-2: #bbc1c7;
    --recovery-text-3: #89929b;
    --recovery-action: #f4f6f7;
    --recovery-action-hover: #ffffff;
    --recovery-on-action: #141619;
    --recovery-positive: #72d6a6;
    --recovery-positive-bg: rgba(66, 190, 128, .16);
    --recovery-warning: #f1b35f;
    --recovery-warning-bg: rgba(221, 147, 50, .14);
    --recovery-accent-soft: rgba(79, 179, 130, .12);
  }

  .mas-recovery-field,
  .mas-recovery-field::before,
  .mas-recovery-field::after {
    position: absolute;
    pointer-events: none;
  }

  .mas-recovery-field { inset: 0; overflow: hidden; z-index: -1; }
  .mas-recovery-field::before,
  .mas-recovery-field::after {
    border-radius: 999px;
    content: '';
    filter: blur(78px);
  }
  .mas-recovery-field::before {
    width: 520px;
    height: 520px;
    top: -240px;
    right: -170px;
    background: var(--recovery-warning-bg);
    opacity: .72;
  }
  .mas-recovery-field::after {
    width: 470px;
    height: 470px;
    bottom: -220px;
    left: -150px;
    background: var(--recovery-accent-soft);
    opacity: .8;
  }

  .mas-recovery-stack {
    display: flex;
    width: 100%;
    min-width: 0;
    max-width: 520px;
    flex-direction: column;
    align-items: center;
    gap: 20px;
  }

  .mas-recovery-brand {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 32px;
  }

  .mas-recovery-brand-logo {
    display: block;
    width: 124px;
    height: auto;
  }

  [data-appearance='dark'] .mas-recovery-brand {
    padding: 7px 10px;
    border: 1px solid rgba(255, 255, 255, .08);
    border-radius: 11px;
    background: #f7f7f7;
  }

  .mas-recovery-card {
    position: relative;
    width: 100%;
    min-width: 0;
    overflow: hidden;
    padding: 38px 38px 30px;
    border: 1px solid var(--recovery-border);
    border-radius: 22px;
    background: var(--recovery-card);
    box-shadow: 0 24px 64px rgba(17, 17, 19, .10), 0 2px 8px rgba(17, 17, 19, .05);
  }

  [data-appearance='dark'] .mas-recovery-card {
    box-shadow: 0 24px 64px rgba(0, 0, 0, .3), 0 2px 8px rgba(0, 0, 0, .2);
  }

  .mas-recovery-watermark {
    position: absolute;
    top: -25px;
    right: 5px;
    color: var(--recovery-text);
    font-size: 166px;
    font-weight: 700;
    line-height: 1;
    letter-spacing: -.07em;
    opacity: .035;
    pointer-events: none;
    user-select: none;
  }

  .mas-recovery-icon {
    position: relative;
    display: grid;
    width: 60px;
    height: 60px;
    place-items: center;
    border: 1px solid color-mix(in srgb, var(--recovery-warning) 18%, transparent);
    border-radius: 16px;
    color: var(--recovery-warning);
    background: var(--recovery-warning-bg);
  }

  .mas-recovery-icon::after {
    position: absolute;
    inset: -6px;
    border: 1.5px solid color-mix(in srgb, var(--recovery-warning) 26%, transparent);
    border-radius: 20px;
    animation: mas-recovery-ring 2.8s ease-out infinite;
    content: '';
    opacity: 0;
  }

  .mas-recovery-eyebrow {
    margin: 24px 0 0;
    color: var(--recovery-warning);
    font-family: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: .14em;
    text-transform: uppercase;
  }

  .mas-recovery-title {
    margin: 9px 0 0;
    color: var(--recovery-text);
    font-size: clamp(28px, 5vw, 34px);
    font-weight: 650;
    line-height: 1.08;
    letter-spacing: -.035em;
  }

  .mas-recovery-lead {
    max-width: 415px;
    margin: 13px 0 0;
    color: var(--recovery-text-2);
    font-size: 15.5px;
    line-height: 1.6;
  }

  .mas-recovery-meta {
    display: flex;
    align-items: center;
    margin-top: 22px;
  }

  .mas-recovery-code-chip {
    display: inline-flex;
    min-height: 44px;
    align-items: center;
    gap: 8px;
    padding: 5px 5px 5px 13px;
    border: 1px solid var(--recovery-border-strong);
    border-radius: 11px;
    background: var(--recovery-surface-2);
  }

  .mas-recovery-code {
    color: var(--recovery-text-2);
    font-family: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12.5px;
    letter-spacing: .01em;
  }

  .mas-recovery-code strong { color: var(--recovery-text); font-weight: 700; }

  .mas-recovery-copy {
    display: inline-flex;
    min-width: 44px;
    min-height: 44px;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 0 10px;
    border: 0;
    border-radius: 7px;
    color: var(--recovery-text-2);
    background: var(--recovery-surface-3);
    cursor: pointer;
    font: inherit;
    font-size: 11px;
    font-weight: 700;
    transition: color .14s ease, background .14s ease;
  }

  .mas-recovery-copy:hover { color: var(--recovery-text); background: var(--recovery-border-strong); }
  .mas-recovery-copy[data-state='copied'] { color: var(--recovery-positive); background: var(--recovery-positive-bg); }
  .mas-recovery-copy[data-state='failed'] { color: var(--recovery-warning); background: var(--recovery-warning-bg); }

  .mas-recovery-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 26px;
  }

  .mas-recovery-button {
    display: inline-flex;
    min-height: 46px;
    align-items: center;
    justify-content: center;
    gap: 9px;
    padding: 0 20px;
    border: 1px solid transparent;
    border-radius: 10px;
    cursor: pointer;
    font: inherit;
    font-size: 14.5px;
    font-weight: 700;
    text-decoration: none;
    transition: background .14s ease, border-color .14s ease, transform .12s ease;
  }

  .mas-recovery-button:active { transform: scale(.98); }
  .mas-recovery-button-primary {
    border-color: var(--recovery-action);
    color: var(--recovery-on-action);
    background: var(--recovery-action);
    box-shadow: 0 3px 8px rgba(17, 17, 19, .14);
  }
  .mas-recovery-button-primary:hover { background: var(--recovery-action-hover); }
  .mas-recovery-button-secondary {
    border-color: var(--recovery-border-strong);
    color: var(--recovery-text);
    background: var(--recovery-card);
  }
  .mas-recovery-button-secondary:hover { background: var(--recovery-surface-3); }
  .mas-recovery-button:disabled { cursor: wait; opacity: .72; }
  .mas-recovery-button[data-loading='true'] svg { animation: mas-recovery-spin .7s linear infinite; }

  .mas-recovery-foot {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 26px;
    padding-top: 18px;
    border-top: 1px solid var(--recovery-divider);
    color: var(--recovery-text-3);
    font-size: 13px;
  }

  .mas-recovery-foot a { color: var(--recovery-text-2); font-weight: 700; text-decoration: none; }
  .mas-recovery-foot a:hover { color: var(--recovery-text); text-decoration: underline; text-underline-offset: 3px; }

  .mas-recovery-button:focus-visible,
  .mas-recovery-copy:focus-visible,
  .mas-recovery-foot a:focus-visible {
    outline: 3px solid color-mix(in srgb, var(--recovery-warning) 42%, transparent);
    outline-offset: 3px;
  }

  .mas-recovery-live {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    white-space: nowrap;
  }

  @keyframes mas-recovery-ring {
    0% { opacity: .7; transform: scale(.9); }
    70%, 100% { opacity: 0; transform: scale(1.08); }
  }

  @keyframes mas-recovery-spin { to { transform: rotate(360deg); } }

  @media (max-width: 520px) {
    .mas-recovery-page { grid-template-columns: minmax(0, 1fr); align-items: center; padding: 24px 16px; }
    .mas-recovery-stack { gap: 16px; }
    .mas-recovery-card { padding: 30px 24px 25px; border-radius: 20px; }
    .mas-recovery-watermark { top: -10px; font-size: 116px; }
    .mas-recovery-title { font-size: 28px; }
    .mas-recovery-lead { font-size: 15px; }
    .mas-recovery-code-chip { width: 100%; justify-content: space-between; }
    .mas-recovery-actions { display: grid; grid-template-columns: 1fr; }
    .mas-recovery-button { width: 100%; }
  }

  @media (max-width: 360px) {
    .mas-recovery-page { padding-inline: 12px; }
    .mas-recovery-card { padding-inline: 20px; }
    .mas-recovery-copy span { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  }

  @media (prefers-reduced-motion: reduce) {
    .mas-recovery-page *,
    .mas-recovery-page *::before,
    .mas-recovery-page *::after {
      scroll-behavior: auto !important;
      animation-duration: .01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: .01ms !important;
    }
  }
`;

export function RecoveryScreen({
  kind,
  title,
  description,
  code,
  homeHref,
  homeLabel,
  retryLabel = "Tekrar dene",
  onRetry,
  appearance = "light",
  statusHref,
}: RecoveryScreenProps) {
  const titleId = useId();
  const statusId = useId();
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  const [retrying, setRetrying] = useState(false);
  const [retryFailed, setRetryFailed] = useState(false);
  const safeStatusHref = getSafeStatusHref(statusHref);
  const watermark = kind === "not-found" ? "404" : "500";
  const eyebrow = kind === "not-found" ? "Sayfa bulunamadı" : "Sistem hatası";
  const isHomePrimary = !onRetry;

  useEffect(
    () => () => {
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
      if (retryTimer.current) clearTimeout(retryTimer.current);
    },
    [],
  );

  const handleCopy = async () => {
    const clipboard =
      typeof navigator === "undefined" ? undefined : navigator.clipboard;
    const result = await copyRecoveryCode(code, clipboard);
    setCopyState(result);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setCopyState("idle"), 2200);
  };

  const handleRetry = async () => {
    if (!onRetry || retrying) return;

    setRetryFailed(false);
    setRetrying(true);

    try {
      await onRetry();
      retryTimer.current = setTimeout(() => setRetrying(false), 600);
    } catch {
      setRetrying(false);
      setRetryFailed(true);
    }
  };

  const copyLabel =
    copyState === "copied"
      ? "Kopyalandı"
      : copyState === "failed"
        ? "Kopyalanamadı"
        : "Kopyala";

  return (
    <main className="mas-recovery-page" data-appearance={appearance}>
      <style>{recoveryStyles}</style>
      <div className="mas-recovery-field" aria-hidden="true" />

      <div className="mas-recovery-stack">
        <div className="mas-recovery-brand">
          <img
            className="mas-recovery-brand-logo"
            src={MASABU_LOGO_DATA_URI}
            alt="masabu"
            width={256}
            height={55}
          />
        </div>

        <section
          className="mas-recovery-card"
          aria-labelledby={titleId}
          aria-describedby={statusId}
        >
          <span className="mas-recovery-watermark" aria-hidden="true">
            {watermark}
          </span>

          <div className="mas-recovery-icon" aria-hidden="true">
            <TriangleAlert size={30} strokeWidth={2} />
          </div>

          <p className="mas-recovery-eyebrow">{eyebrow}</p>
          <h1 id={titleId} className="mas-recovery-title">
            {title}
          </h1>
          <p className="mas-recovery-lead">{description}</p>

          <div className="mas-recovery-meta">
            <span className="mas-recovery-code-chip">
              <span className="mas-recovery-code">
                Hata kodu: <strong>{code}</strong>
              </span>
              <button
                type="button"
                className="mas-recovery-copy"
                data-state={copyState}
                aria-label={`Hata kodunu kopyala: ${code}`}
                onClick={handleCopy}
              >
                {copyState === "copied" ? (
                  <Check size={14} aria-hidden="true" />
                ) : (
                  <Copy size={14} aria-hidden="true" />
                )}
                <span>{copyLabel}</span>
              </button>
            </span>
          </div>

          <div className="mas-recovery-actions">
            {onRetry ? (
              <button
                type="button"
                className="mas-recovery-button mas-recovery-button-primary"
                data-loading={retrying}
                disabled={retrying}
                onClick={handleRetry}
              >
                <RefreshCw size={18} aria-hidden="true" />
                {retrying ? "Yeniden deneniyor…" : retryLabel}
              </button>
            ) : null}
            <a
              href={homeHref}
              className={`mas-recovery-button ${isHomePrimary ? "mas-recovery-button-primary" : "mas-recovery-button-secondary"}`}
            >
              <House size={18} aria-hidden="true" />
              {homeLabel}
            </a>
          </div>

          {safeStatusHref ? (
            <div className="mas-recovery-foot">
              <Info size={16} aria-hidden="true" />
              <span>
                Sorun sürerse{" "}
                <a href={safeStatusHref} target="_blank" rel="noreferrer">
                  sistem durumunu kontrol edin
                </a>
              </span>
            </div>
          ) : null}

          <p
            id={statusId}
            className="mas-recovery-live"
            role="status"
            aria-live="polite"
          >
            {copyState === "copied"
              ? `Hata kodu ${code} panoya kopyalandı.`
              : copyState === "failed"
                ? "Hata kodu kopyalanamadı. Kodu elle seçip kopyalayabilirsiniz."
                : retryFailed
                  ? "Tekrar deneme başlatılamadı. Lütfen yeniden deneyin."
                  : retrying
                    ? "Ekran yeniden yükleniyor."
                    : ""}
          </p>
        </section>
      </div>
    </main>
  );
}
