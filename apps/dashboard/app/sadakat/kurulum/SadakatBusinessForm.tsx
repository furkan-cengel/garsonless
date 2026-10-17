"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSadakatBusinessAction } from "../../../lib/actions/sadakat";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
export default function SadakatBusinessForm() {
  const [name, setName] = useState(""),
    [slug, setSlug] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const requestId = useRef<string | null>(null);
  const router = useRouter();
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          requestId.current ??= crypto.randomUUID();
          const result = await createSadakatBusinessAction({
            name,
            slug,
            requestId: requestId.current,
          });
          if ("error" in result) setError(result.error);
          else router.push(`/sadakat/${result.restaurantId}`);
        } catch {
          setError("İşletme oluşturulamadı. Tekrar dene.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="business-name">İşletme adı</FieldLabel>
          <Input
            id="business-name"
            required
            maxLength={120}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              requestId.current = null;
            }}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="business-slug">
            Kart bağlantısındaki ad
          </FieldLabel>
          <Input
            id="business-slug"
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            minLength={3}
            maxLength={80}
            placeholder="mola-coffee"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              requestId.current = null;
            }}
          />
        </Field>
        {error && <p role="alert">{error}</p>}
        <Button type="submit" disabled={busy}>
          {busy ? "Oluşturuluyor…" : "İşletmeyi oluştur"}
        </Button>
      </FieldGroup>
    </form>
  );
}
