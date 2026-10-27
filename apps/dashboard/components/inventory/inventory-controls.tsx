"use client";
import { useId, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
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
  hint,
  accessibleLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Visible label when it differs from the accessible one, e.g. a unit next to a named row. */
  accessibleLabel?: string;
  numeric?: boolean;
  disabled?: boolean;
  /** Plain-language note for inventory terms a cafe owner may not know. */
  hint?: string;
}) {
  const id = useId();
  return (
    <Field>
      <FieldLabel htmlFor={id}>
        {accessibleLabel ? <><span aria-hidden="true">{label}</span><span className="sr-only">{accessibleLabel}</span></> : label}
      </FieldLabel>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode={numeric ? "decimal" : undefined}
        disabled={disabled}
      />
      {hint && <FieldDescription>{hint}</FieldDescription>}
    </Field>
  );
}
export function Choice({
  label,
  value,
  onChange,
  children,
  disabled = false,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  disabled?: boolean;
  hint?: string;
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
      {hint && <FieldDescription>{hint}</FieldDescription>}
    </Field>
  );
}
export { NativeSelectOption as Option };

/** Confirmation for ledger actions that cannot be taken back with one click. */
export function ConfirmAction({
  open,
  title,
  description,
  confirmLabel,
  destructive = false,
  onCancel,
  onConfirm,
  children,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  children?: ReactNode;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!next) onCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel>Vazgeç</AlertDialogCancel>
          <AlertDialogAction variant={destructive ? "destructive" : "default"} onClick={onConfirm}>{confirmLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
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
