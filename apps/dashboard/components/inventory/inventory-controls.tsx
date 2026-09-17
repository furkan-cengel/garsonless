"use client";
import { useId, type ReactNode } from "react";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
export function TextField({
  label,
  value,
  onChange,
  numeric = false,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  numeric?: boolean;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode={numeric ? "decimal" : undefined}
        disabled={disabled}
      />
    </Field>
  );
}
export function Choice({
  label,
  value,
  onChange,
  children,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <NativeSelect
        id={id}
        className="w-full"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {children}
      </NativeSelect>
    </Field>
  );
}
export { NativeSelectOption as Option };
export const decimal = (value: string) => value.trim().replace(",", ".");
export const amount = (value: string | number | null) =>
  value === null
    ? "Eksik maliyet"
    : new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 3 }).format(
        Number(value),
      );
export const money = (value: string | number | null) =>
  value === null
    ? "Eksik maliyet"
    : new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency: "TRY",
        maximumFractionDigits: 2,
      }).format(Number(value));
export const kinds: Record<string, string> = {
  raw: "Hammadde",
  finished: "Hazır ürün",
  prepared: "Yarı mamul",
  opening: "Açılış",
  receipt: "Mal kabul",
  waste: "Fire",
  adjustment: "Düzeltme",
  external_sale: "Dış satış",
  production: "Üretim",
  sale: "Sipariş tüketimi",
  cancellation_return: "İptal iadesi",
  return: "Tüketim iadesi",
  count_approve: "Sayım farkı",
};
