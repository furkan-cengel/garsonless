"use client";
import { useEffect, useState } from "react";
import { customerRewardMessage, type CustomerRewardNotice } from "@garsonless/domain/customers";
import { AppIcons as I } from "@garsonless/ui/icons";
import type { ApiResult } from "../../../lib/customer-auth-contract";

/** Shows a signed-in customer the automatic rewards they got since their last visit to the menu. */
export function RewardNoticeCard({ restaurantId, enabled }: { restaurantId: string; enabled: boolean }) {
  const [notices, setNotices] = useState<CustomerRewardNotice[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    fetch(`/api/account/reward-notices?restaurantId=${encodeURIComponent(restaurantId)}`)
      .then((response) => response.json() as Promise<ApiResult<{ notices: CustomerRewardNotice[] }>>)
      .then((result) => { if (live && result.ok) setNotices(result.data.notices); })
      .catch(() => {});
    return () => { live = false; };
  }, [enabled, restaurantId]);

  if (!enabled || notices.length === 0) return null;
  const [latest] = notices;
  const total = notices.reduce((sum, notice) => sum + notice.points, 0);
  const message = customerRewardMessage(latest!.kind, total);

  function dismiss() {
    setNotices([]);
    void fetch("/api/account/reward-notices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId }),
    }).catch(() => {});
  }

  return (
    <section
      data-component="reward-notice"
      role="status"
      style={{
        position: "fixed",
        left: 12,
        right: 12,
        // Top, so it never covers the floating cart button.
        top: "calc(12px + env(safe-area-inset-top))",
        zIndex: 60,
        maxWidth: 440,
        margin: "0 auto",
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: 14,
        borderRadius: 16,
        border: "1px solid var(--p-border)",
        background: "var(--p-card)",
        color: "var(--p-text)",
        boxShadow: "0 12px 32px rgba(0,0,0,.18)",
        fontFamily: "var(--p-body)",
      }}
    >
      <span aria-hidden="true" style={{ flex: "0 0 auto", width: 38, height: 38, borderRadius: 12, display: "grid", placeItems: "center", background: "var(--p-accent-soft)", color: "var(--p-accent)" }}>
        <I.gift size={19} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ display: "block", fontSize: 14, fontFamily: "var(--p-display)" }}>
          {notices.length > 1 ? `${notices.length} ödül kazandın` : message.title}
        </strong>
        <p style={{ margin: "3px 0 0", fontSize: 12.5, lineHeight: 1.45, color: "var(--p-text-2)" }}>{message.body}</p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Ödül bildirimini kapat"
        style={{ flex: "0 0 auto", minWidth: 44, minHeight: 44, margin: -8, border: 0, background: "transparent", color: "var(--p-text-2)", cursor: "pointer", display: "grid", placeItems: "center" }}
      >
        <I.close size={18} />
      </button>
    </section>
  );
}
