"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  sadakatProgress,
  type SadakatCard,
  type SadakatConfig,
  type SadakatDashboard,
  type SadakatStaff,
} from "@garsonless/domain/sadakat";
import {
  mutateSadakatAction,
  resolveSadakatAction,
  saveSadakatAction,
  setSadakatStaffStatus,
} from "../../lib/actions/sadakat";
import { inviteMember } from "../../lib/actions/team";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import SadakatScanner from "./SadakatScanner";
import SadakatJoinQR from "./SadakatJoinQR";

const date = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })
    : "—";
export default function SadakatDashboardClient({
  dashboard: d,
  team,
  menuBase,
}: {
  dashboard: SadakatDashboard;
  team: SadakatStaff[];
  menuBase: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [code, setCode] = useState("");
  const [customer, setCustomer] = useState<{
    name: string | null;
    card: SadakatCard;
  } | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [manual, setManual] = useState(false);
  const [email, setEmail] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [config, setConfig] = useState<SadakatConfig>(
    d.program ?? {
      name: d.restaurantName,
      logoUrl: null,
      color: "#174C3C",
      goal: d.initialGoal,
      reward: d.initialReward || "Ücretsiz kahve",
      eligibleProducts: "Kahveler",
    },
  );
  const pending = useRef<{ fingerprint: string; id: string } | null>(null);
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setMessage("");
    setFailed(false);
    try {
      await work();
    } catch (e) {
      setFailed(true);
      setMessage(
        e instanceof Error ? e.message : "İşlem tamamlanamadı. Tekrar dene.",
      );
    } finally {
      setBusy(false);
    }
  };
  const scan = async (value: string) => {
    setCode(value);
    setCustomer(null);
    setManual(false);
    await run(async () => {
      const result = await resolveSadakatAction(d.restaurantId, value);
      if ("error" in result) throw new Error(result.error);
      setCustomer({ name: result.name, card: result.card });
    });
  };
  const transact = async (
    kind: "earn" | "redeem" | "reversal",
    reverseId?: string,
  ) =>
    run(async () => {
      const payload =
        kind === "reversal"
          ? { kind, reverseId, reason: reasons[reverseId!] ?? "" }
          : kind === "earn"
            ? { kind, code, quantity }
            : { kind, code };
      const fingerprint = JSON.stringify(payload);
      if (pending.current?.fingerprint !== fingerprint)
        pending.current = { fingerprint, id: crypto.randomUUID() };
      const result = await mutateSadakatAction(d.restaurantId, {
        ...payload,
        requestId: pending.current!.id,
      });
      if ("error" in result) throw new Error(result.error);
      pending.current = null;
      if (kind !== "reversal") {
        setCustomer((current) =>
          current
            ? {
                ...current,
                card: { ...current.card, stamps: result.result.stamps },
              }
            : null,
        );
        setManual(false);
      }
      setMessage(
        kind === "earn"
          ? `${result.result.delta} damga verildi.`
          : kind === "redeem"
            ? "Ödül kullanıldı."
            : "İşlem gerekçeli kayıtla geri alındı.",
      );
      router.refresh();
    });
  const url = `${menuBase.replace(/\/$/, "")}/sadakat/${d.slug}`;
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-4 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/sadakat" className="text-sm text-muted-foreground">
            Masabu Sadakat
          </Link>
          <h1 className="text-3xl font-semibold">
            {d.program?.name ?? d.restaurantName}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {d.access
            ? `Pilot bitişi: ${date(d.access.endsAt)}`
            : "Pilot erişimi atanmadı"}
        </p>
      </header>
      {!d.active && (
        <Alert>
          <AlertDescription>
            Pilot erişimi aktif değil. Kart ve geçmiş korunuyor; yeni katılım ve
            işlemler duraklatıldı. Pilot erişimi için Masabu ekibiyle iletişime
            geç.
          </AlertDescription>
        </Alert>
      )}
      {message && (
        <Alert variant={failed ? "destructive" : "default"}>
          <AlertDescription role={failed ? "alert" : "status"}>
            {message}
          </AlertDescription>
        </Alert>
      )}
      {d.program && (
        <Card>
          <CardHeader>
            <CardTitle>Kasa</CardTitle>
            <CardDescription>
              Müşterinin kişisel QR’ını okut veya kodunu yaz.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {d.active && (
              <SadakatScanner
                onCode={(value) => {
                  if (!busy) void scan(value);
                }}
              />
            )}
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void scan(code);
              }}
            >
              <Field className="min-w-0 flex-1">
                <FieldLabel htmlFor="customer-code">Müşteri kodu</FieldLabel>
                <Input
                  id="customer-code"
                  value={code}
                  maxLength={32}
                  placeholder="ABCD 1234 EFGH 5678"
                  onChange={(e) => {
                    setCode(e.target.value);
                    setCustomer(null);
                  }}
                />
              </Field>
              <Button type="submit" disabled={busy || !d.active}>
                Kartı aç
              </Button>
            </form>
            {customer && (
              <div className="flex flex-col gap-4 rounded-xl border p-4">
                <h2 className="text-xl font-semibold">
                  {customer.name ?? "Müşteri"} · {customer.card.stamps} damga
                </h2>
                <p>
                  {
                    sadakatProgress(customer.card.stamps, d.program.goal)
                      .rewards
                  }{" "}
                  hazır ödül · {d.program.reward}
                </p>
                <Field>
                  <FieldLabel htmlFor="quantity">Uygun ürün adedi</FieldLabel>
                  <Input
                    id="quantity"
                    type="number"
                    min={1}
                    max={20}
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                  />
                </Field>
                <FieldDescription>
                  Bu ekranı yalnızca Masabu siparişinden otomatik damga
                  kazanmamış alışverişlerde kullan.
                </FieldDescription>
                <label className="flex items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={manual}
                    onChange={(e) => setManual(e.target.checked)}
                    disabled={busy}
                  />{" "}
                  Bu alışverişe otomatik damga verilmediğini kontrol ettim.
                </label>
                <div className="flex flex-wrap gap-3">
                  <Button
                    disabled={
                      busy ||
                      !d.active ||
                      !manual ||
                      quantity < 1 ||
                      quantity > 20
                    }
                    onClick={() => void transact("earn")}
                  >
                    Damga ver
                  </Button>
                  <Button
                    variant="outline"
                    disabled={
                      busy || !d.active || customer.card.stamps < d.program.goal
                    }
                    onClick={() => void transact("redeem")}
                  >
                    Ödülü kullandır
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      {d.isOwner && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>
                {d.program ? "Kart ayarları" : "Sadakat kartını oluştur"}
              </CardTitle>
              <CardDescription>
                Menü veya POS kurulumu gerekmez.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    const result = await saveSadakatAction(
                      d.restaurantId,
                      config,
                    );
                    if ("error" in result) throw new Error(result.error);
                    setMessage("Kart kaydedildi.");
                    router.refresh();
                  });
                }}
              >
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="name">Karttaki işletme adı</FieldLabel>
                    <Input
                      id="name"
                      required
                      maxLength={120}
                      value={config.name}
                      onChange={(e) =>
                        setConfig({ ...config, name: e.target.value })
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="logo">
                      Logo bağlantısı (isteğe bağlı)
                    </FieldLabel>
                    <Input
                      id="logo"
                      type="url"
                      placeholder="https://…"
                      value={config.logoUrl ?? ""}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          logoUrl: e.target.value || null,
                        })
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="color">Kart rengi</FieldLabel>
                    <Input
                      id="color"
                      type="color"
                      value={config.color}
                      onChange={(e) =>
                        setConfig({ ...config, color: e.target.value })
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="goal">
                      Ödül için gereken damga
                    </FieldLabel>
                    <Input
                      id="goal"
                      type="number"
                      min={2}
                      max={100}
                      required
                      disabled={d.program?.goalLocked || d.initialGoalLocked}
                      value={config.goal}
                      onChange={(e) =>
                        setConfig({ ...config, goal: Number(e.target.value) })
                      }
                    />
                    <FieldDescription>
                      İlk damgadan sonra hedef sabit kalır.
                    </FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="reward">Ödül açıklaması</FieldLabel>
                    <Input
                      id="reward"
                      required
                      maxLength={300}
                      value={config.reward}
                      onChange={(e) =>
                        setConfig({ ...config, reward: e.target.value })
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="eligible">
                      Damga kazandıran ürünler
                    </FieldLabel>
                    <Input
                      id="eligible"
                      required
                      maxLength={500}
                      value={config.eligibleProducts}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          eligibleProducts: e.target.value,
                        })
                      }
                    />
                  </Field>
                  {d.networkScope && (
                    <p role="alert">
                      Mevcut kartın ağ kapsamını taşıyor. Tek işletme pilotuna
                      geçiş için Masabu ekibiyle görüş; mevcut bakiyeler
                      otomatik değiştirilmez.
                    </p>
                  )}
                  <Button
                    type="submit"
                    disabled={busy || !d.active || d.networkScope}
                  >
                    Kartı kaydet
                  </Button>
                </FieldGroup>
              </form>
            </CardContent>
          </Card>
          {d.program && (
            <Card data-sadakat-print>
              <CardHeader>
                <CardTitle>Müşteri katılım bağlantısı</CardTitle>
                <CardDescription>
                  Kasaya bu QR’ı koy. Kart oluşturur; damga kazandırmaz.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SadakatJoinQR url={url} />
                <Button
                  className="mt-4"
                  variant="outline"
                  onClick={() => window.print()}
                >
                  QR’ı yazdır
                </Button>
              </CardContent>
            </Card>
          )}
          {d.report && (
            <Card>
              <CardHeader>
                <CardTitle>Sadakat özeti</CardTitle>
                <CardDescription>
                  Başlangıçtan bugüne · Ziyaret, müşterinin işlem yaptığı
                  İstanbul takvim günüdür.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-5 md:grid-cols-5">
                  {[
                    ["Katılan", d.report.members],
                    ["Damga", d.report.stampsIssued],
                    ["Kullanılan ödül", d.report.rewardsUsed],
                    ["İlk ziyareti olan", d.report.newCustomers],
                    ["Tekrar gelen", d.report.returningCustomers],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-sm text-muted-foreground">{label}</dt>
                      <dd className="text-2xl font-semibold">{value}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Müşteriler</CardTitle>
              <CardDescription>
                En yeni 100 katılım · Telefonlar maskelenir.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {!d.customers?.length && <p>Henüz katılan müşteri yok.</p>}
              {d.customers?.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-wrap justify-between gap-3 border-b pb-3"
                >
                  <div>
                    <strong>{c.name ?? "Müşteri"}</strong>
                    <p className="text-sm text-muted-foreground">
                      {c.phone ?? "Telefon yok"} · Katılım {date(c.joinedAt)}
                    </p>
                  </div>
                  <div className="text-sm">
                    {c.stamps} damga ·{" "}
                    {d.program
                      ? Math.floor(Math.max(0, c.stamps) / d.program.goal)
                      : 0}{" "}
                    ödül · {c.visits} ziyaret
                    <p className="text-muted-foreground">
                      Son ziyaret {date(c.lastVisit)}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Personel</CardTitle>
              <CardDescription>
                Personel yalnızca kasa işlemlerine erişir.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <form
                className="flex flex-wrap items-end gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    const result = await inviteMember(d.restaurantId, {
                      email,
                      permissions: ["sadakat"],
                    });
                    if ("error" in result) throw new Error(result.error);
                    setMessage("Personel daveti oluşturuldu.");
                    setEmail("");
                    if (result.devInviteUrl) setInviteUrl(result.devInviteUrl);
                    router.refresh();
                  });
                }}
              >
                <Field className="min-w-0 flex-1">
                  <FieldLabel htmlFor="staff-email">
                    Personel e-postası
                  </FieldLabel>
                  <Input
                    id="staff-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>
                <Button type="submit" disabled={busy || !d.active}>
                  Davet et
                </Button>
              </form>
              {inviteUrl && (
                <a href={inviteUrl} className="break-all text-sm underline">
                  Geliştirme ortamı davet bağlantısı
                </a>
              )}
              {team.map((member) => (
                <div
                  key={member.id}
                  className="flex flex-wrap items-center justify-between gap-3"
                >
                  <span>
                    {member.email} ·{" "}
                    {member.status === "active"
                      ? "Aktif"
                      : member.status === "disabled"
                        ? "Pasif"
                        : "Davet bekliyor"}
                  </span>
                  {member.status !== "invited" && (
                    <Button
                      variant="outline"
                      disabled={busy || !d.active}
                      onClick={() =>
                        void run(async () => {
                          const result = await setSadakatStaffStatus(
                            d.restaurantId,
                            member.id,
                            member.status === "active" ? "disabled" : "active",
                          );
                          if ("error" in result) throw new Error(result.error);
                          router.refresh();
                        })
                      }
                    >
                      {member.status === "active"
                        ? "Erişimi kapat"
                        : "Erişimi aç"}
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Kasa işlem geçmişi</CardTitle>
              <CardDescription>
                En son 100 manuel işlem · Otomatik işlemler müşteri kartı
                geçmişinde görünür.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {!d.operations?.length && <p>Henüz kasa işlemi yok.</p>}
              {d.operations?.map((o) => (
                <div key={o.id} className="flex flex-col gap-2 border-b pb-4">
                  <p>
                    <strong>{o.name ?? "Müşteri"}</strong> ·{" "}
                    {o.kind === "earn"
                      ? "Damga verildi"
                      : o.kind === "redeem"
                        ? "Ödül kullanıldı"
                        : "Geri alma"}{" "}
                    · {o.delta > 0 ? "+" : ""}
                    {o.delta}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {date(o.createdAt)} · Personel {o.actorId}
                  </p>
                  {o.kind === "reversal" && <p>{o.reason}</p>}
                  {o.reversed ? (
                    <p>Geri alındı.</p>
                  ) : (
                    o.kind !== "reversal" && (
                      <form
                        className="flex flex-wrap items-end gap-3"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void transact("reversal", o.id);
                        }}
                      >
                        <Field className="min-w-0 flex-1">
                          <FieldLabel htmlFor={`reason-${o.id}`}>
                            Geri alma gerekçesi
                          </FieldLabel>
                          <Input
                            id={`reason-${o.id}`}
                            required
                            minLength={3}
                            maxLength={500}
                            value={reasons[o.id] ?? ""}
                            onChange={(e) =>
                              setReasons({ ...reasons, [o.id]: e.target.value })
                            }
                          />
                        </Field>
                        <Button
                          type="submit"
                          variant="outline"
                          disabled={busy || !d.active}
                        >
                          İşlemi geri al
                        </Button>
                      </form>
                    )
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
      <footer className="text-sm text-muted-foreground">
        Masabu Sadakat · Bağımsız sadakat pilotu
      </footer>
    </main>
  );
}
