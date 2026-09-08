"use client";
import { useEffect, useId, useRef, useState } from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";

export default function LoyaltyNumberField({
  value,
  onChange,
  suffix,
  min = 0,
  max,
  step = 1,
  width = 120,
  ariaLabel,
  ariaDescribedBy,
}: {
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
  width?: number | string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
}) {
  const [text, setText] = useState(String(value));
  const [editing, setEditing] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const errorId = useId();
  const n = text.trim() === "" ? NaN : Number(text.replace(",", "."));
  const invalid =
    !Number.isFinite(n) ||
    n < min ||
    (max !== undefined && n > max) ||
    Math.abs((n - min) / step - Math.round((n - min) / step)) > 1e-7;
  const error = invalid
    ? `Geçerli bir sayı girin (${min}${max === undefined ? " ve üzeri" : `-${max}`}${step === 1 ? ", tam sayı" : ""}).`
    : "";
  useEffect(() => {
    if (!editing) setText(Number.isFinite(value) ? String(value) : "");
  }, [value, editing]);
  useEffect(() => {
    input.current?.setCustomValidity(error);
  }, [error]);
  return (
    <div className="max-w-full shrink-0" style={{ width }}>
      <InputGroup className="h-9">
        <InputGroupInput
          ref={input}
          aria-label={ariaLabel}
          aria-invalid={invalid}
          aria-describedby={
            [ariaDescribedBy, invalid ? errorId : undefined]
              .filter(Boolean)
              .join(" ") || undefined
          }
          inputMode={step === 1 ? "numeric" : "decimal"}
          value={text}
          className="text-center font-semibold"
          onFocus={() => setEditing(true)}
          onBlur={() => setEditing(false)}
          onChange={(event) => {
            const raw = event.target.value;
            setText(raw);
            onChange(raw.trim() === "" ? NaN : Number(raw.replace(",", ".")));
          }}
        />
        {suffix && (
          <InputGroupAddon align="inline-end">
            <InputGroupText>{suffix}</InputGroupText>
          </InputGroupAddon>
        )}
      </InputGroup>
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
