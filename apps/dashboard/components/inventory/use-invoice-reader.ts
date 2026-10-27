"use client";
import { useEffect, useRef, useState } from "react";
import type { InvoiceImport, InvoiceImportJob } from "@garsonless/application/invoice-import";
import { downscalePhoto } from "../onboarding/menu-import-client";

const ERRORS: Record<string, string> = {
  quota_exceeded: "Bugünkü fatura okuma hakkı doldu (günde 20). Satırları elle girebilirsin.",
  photo_limit: "En fazla 4 sayfa fotoğrafı gönderebilirsin.",
  file_too_large: "Dosya çok büyük. Fotoğraf çek ya da 3 MB’tan küçük bir PDF seç.",
  pdf_page_limit: "PDF en fazla 4 sayfa olabilir.",
  invalid_file: "Bu dosya okunamadı. Fatura fotoğrafı (JPG, PNG) ya da PDF seç.",
  unreadable_invoice: "Faturada ürün satırı bulunamadı. Daha net bir fotoğrafla yeniden dene.",
  provider_busy: "Okuma servisi şu an yoğun. Biraz sonra yeniden dene.",
  timeout: "Okuma zaman aşımına uğradı. Yeniden dene.",
  expired: "Okuma tamamlanamadı. Yeniden dene.",
};
const message = (code: string | null | undefined) => (code && ERRORS[code]) || "Fatura okunamadı. Satırları elle girebilir ya da yeniden deneyebilirsin.";

type ReaderState =
  | { status: "idle" }
  | { status: "reading" }
  | { status: "done"; invoice: InvoiceImport }
  | { status: "failed"; error: string };

/** Sends invoice photos or a PDF to the reader and waits for the lines. Nothing is
 * posted to stock here; the receive dialog shows the lines for the user to check. */
export function useInvoiceReader(restaurantId: string) {
  const [available, setAvailable] = useState(false);
  const [state, setState] = useState<ReaderState>({ status: "idle" });
  const polling = useRef<ReturnType<typeof setTimeout> | null>(null);
  const base = `/api/inventory/invoice?restaurantId=${encodeURIComponent(restaurantId)}`;

  useEffect(() => {
    let active = true;
    fetch(base, { cache: "no-store" }).then((r) => r.json()).then((data: { enabled?: boolean }) => { if (active) setAvailable(data.enabled === true); }).catch(() => {});
    return () => { active = false; if (polling.current) clearTimeout(polling.current); };
  }, [base]);

  async function read(files: File[]) {
    if (!files.length || state.status === "reading") return;
    setState({ status: "reading" });
    try {
      const pdf = files.length === 1 && files[0]!.type === "application/pdf";
      let body: BodyInit;
      if (pdf) body = files[0]!;
      else {
        if (files.length > 4) { setState({ status: "failed", error: ERRORS.photo_limit! }); return; }
        const form = new FormData();
        for (const file of files) form.append("photo", await downscalePhoto(file), "page.jpg");
        body = form;
      }
      const response = await fetch(base, { method: "POST", body, headers: { "x-request-id": crypto.randomUUID() } });
      const data = (await response.json()) as { job?: InvoiceImportJob; error?: string };
      if (!response.ok || !data.job) { setState({ status: "failed", error: message(data.error) }); return; }
      await poll(data.job.id, Date.now());
    } catch {
      setState({ status: "failed", error: message(null) });
    }
  }

  async function poll(id: string, started: number) {
    try {
      const response = await fetch(`${base}&id=${id}`, { cache: "no-store" });
      const data = (await response.json()) as { job?: InvoiceImportJob; error?: string };
      const job = data.job;
      if (job?.status === "done" && job.result) { setState({ status: "done", invoice: job.result }); return; }
      if (!response.ok || job?.status === "failed") { setState({ status: "failed", error: message(job?.error ?? data.error) }); return; }
    } catch { /* a dropped poll is retried below */ }
    // The worker reads within a minute or two; stop waiting after four.
    if (Date.now() - started > 240_000) { setState({ status: "failed", error: message("timeout") }); return; }
    await new Promise<void>((resolve) => { polling.current = setTimeout(resolve, 2500); });
    await poll(id, started);
  }

  return { available, state, read, reset: () => setState({ status: "idle" }) };
}
