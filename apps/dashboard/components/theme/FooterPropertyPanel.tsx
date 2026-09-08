"use client";

import type { SettingField } from "@garsonless/ui/themes";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldDescription, FieldGroup } from "@/components/ui/field";
import type { FooterStoreDataAvailability } from "./footer-store-data";
import { HeaderPropertyField } from "./ThemePropertyControls";

const FOOTER_FIELD_SECTIONS: Array<{ title: string; ids: string[] }> = [
  { title: "Durum", ids: ["footerEnabled"] },
  { title: "İçerik", ids: ["footerShowLogo", "footerShowAddress", "footerShowContact", "footerShowSocial", "footerShowCopyright"] },
  { title: "Görünüm", ids: ["footerTone"] },
];

interface FooterPropertyPanelProps {
  fields: SettingField[];
  getValue: (field: SettingField) => unknown;
  onChange: (field: SettingField, value: unknown) => void;
  storeDataAvailability: FooterStoreDataAvailability;
  storeSettingsHref: string;
}

function PropertyCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card data-theme-property-card size="sm" className="data-[size=sm]:[--card-spacing:--spacing(2.5)]">
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function fieldNote(field: SettingField, availability: FooterStoreDataAvailability) {
  if (field.id === "footerEnabled") return "Bu ayar işletme içeriğini yönetir; masabu imzasını kaldırmaz.";
  if (field.id === "footerShowContact") return availability.contact
    ? "Telefon, e-posta ve web sitesi bağlantılarını gösterir."
    : "Gösterilecek geçerli telefon, e-posta veya web sitesi eklenmemiş.";
  if (field.id === "footerShowSocial") return availability.social
    ? "Instagram, Facebook, TikTok ve WhatsApp bağlantılarını gösterir."
    : "Gösterilecek geçerli sosyal medya hesabı eklenmemiş.";
  if (field.id === "footerShowAddress" && !availability.address) return "Gösterilecek adres bilgisi eklenmemiş.";
  return null;
}

export function FooterPropertyPanel({ fields, getValue, onChange, storeDataAvailability, storeSettingsHref }: FooterPropertyPanelProps) {
  const readiness = [
    ["Adres", storeDataAvailability.address],
    ["İletişim", storeDataAvailability.contact],
    ["Sosyal medya", storeDataAvailability.social],
  ] as const;
  return (
    <div data-footer-property-panel data-modern-property-panel className="grid min-w-0 max-w-full gap-2.5 overflow-hidden">
      <Alert data-theme-property-note role="note"><AlertDescription>
        Footer yalnız gerçek mağaza verisini gösterir. İşletme alanı kapatılsa bile masabu imzası görünür kalır.
      </AlertDescription></Alert>
      <PropertyCard title="Mağaza verisi">
        <div className="grid gap-2" role="status" aria-label="Footer mağaza verisi durumu">
          {readiness.map(([label, ready]) => (
            <div key={label} className="flex min-h-7 items-center justify-between gap-3 text-sm">
              <span>{label}</span>
              <Badge variant={ready ? "positive" : "warning"}>{ready ? "Hazır" : "Eksik"}</Badge>
            </div>
          ))}
        </div>
        <a href={storeSettingsHref} className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-border px-3 text-sm font-medium text-foreground no-underline transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          Mağaza bilgilerini düzenle
        </a>
      </PropertyCard>
      {FOOTER_FIELD_SECTIONS.map((section) => {
        const sectionFields = section.ids.map((id) => fields.find((field) => field.id === id)).filter((field): field is SettingField => Boolean(field));
        if (!sectionFields.length) return null;
        return (
          <PropertyCard key={section.title} title={section.title}>
            <FieldGroup className="gap-2.5">
              {sectionFields.map((field) => {
                const note = fieldNote(field, storeDataAvailability);
                return (
                  <div key={field.id} className="flex flex-col gap-1">
                    <HeaderPropertyField field={field} value={getValue(field)} onChange={(value) => onChange(field, value)} />
                    {note ? <FieldDescription className="text-xs">{note}</FieldDescription> : null}
                  </div>
                );
              })}
            </FieldGroup>
          </PropertyCard>
        );
      })}
    </div>
  );
}
