"use client";
import { useRef, useState } from "react";
import { grantSadakatPilotAction } from "./sadakat-actions";
const localTime = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
export default function SadakatPilot({
  restaurantId,
}: {
  restaurantId: string;
}) {
  const [start, setStart] = useState(() => localTime(new Date()));
  const [end, setEnd] = useState(() =>
    localTime(new Date(Date.now() + 30 * 86400000)),
  );
  const [reason, setReason] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const pending = useRef<string | null>(null);
  return (
    <section className="detail-card">
      <h2>Masabu Sadakat pilotu</h2>
      <p>
        Yalnızca bağımsız sadakat erişimi açılır. Pro paketi değişmez. Mevcut
        erişim bu tarihlerle güncellenir.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setMessage("");
          pending.current ??= crypto.randomUUID();
          try {
            const result = await grantSadakatPilotAction({
              restaurantId,
              startsAt: new Date(start).toISOString(),
              endsAt: new Date(end).toISOString(),
              reason,
              requestId: pending.current,
            });
            if ("error" in result)
              setMessage(result.error ?? "Erişim kaydedilemedi.");
            else {
              pending.current = null;
              setMessage("Sadakat pilot erişimi kaydedildi.");
            }
          } catch {
            setMessage("Erişim kaydedilemedi. Tekrar dene.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Başlangıç
          <input
            type="datetime-local"
            required
            value={start}
            onChange={(e) => {
              setStart(e.target.value);
              pending.current = null;
            }}
          />
        </label>
        <label>
          Bitiş
          <input
            type="datetime-local"
            required
            value={end}
            onChange={(e) => {
              setEnd(e.target.value);
              pending.current = null;
            }}
          />
        </label>
        <label>
          Gerekçe
          <input
            required
            minLength={10}
            maxLength={1000}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              pending.current = null;
            }}
          />
        </label>
        <button disabled={busy}>Pilot erişimini kaydet</button>
        {message && <p role="status">{message}</p>}
      </form>
    </section>
  );
}
