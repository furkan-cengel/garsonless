"use client";

import { useState, type AriaAttributes } from "react";
import { CalendarDaysIcon, Clock3Icon } from "lucide-react";
import { tr } from "react-day-picker/locale";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { localCouponDate } from "./coupon-editor-model";

// Calendar dates are neutral wall dates. Only parseCouponDraft converts the
// complete restaurant-local date/time into an instant, including DST validation.
function calendarDate(value: string): Date | undefined {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(value);
  if (!match) return undefined;
  const iso = `${match[3]}-${match[2]}-${match[1]}`;
  const date = new Date(`${iso}T12:00:00Z`);
  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === iso
    ? date
    : undefined;
}
function dateText(date: Date) {
  return `${String(date.getUTCDate()).padStart(2, "0")}.${String(date.getUTCMonth() + 1).padStart(2, "0")}.${date.getUTCFullYear()}`;
}

export function CouponDatePicker({
  id,
  value,
  onChange,
  timeZone,
  label,
  disabled = false,
  ...aria
}: AriaAttributes & {
  id: string;
  value: string;
  onChange: (value: string) => void;
  timeZone: string;
  label: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const date = calendarDate(value);
  const clock = value.includes(" ")
    ? value.slice(value.indexOf(" ") + 1)
    : "12:00";
  const todayText = localCouponDate(new Date().toISOString(), timeZone).replace(
    /^(\d{4})-(\d{2})-(\d{2})T.*/,
    "$3.$2.$1",
  );
  const today = calendarDate(todayText);
  return (
    <Popover open={open && !disabled} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            disabled={disabled}
            id={id}
            type="button"
            variant="outline"
            {...aria}
            className="h-9 w-full min-w-0 justify-between font-normal"
          />
        }
      >
        <span className="truncate">
          {date
            ? `${new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeZone: "UTC" }).format(date)}, ${clock || "Saat seçin"}`
            : "Tarih ve saat seç"}
        </span>
        <CalendarDaysIcon className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent
        aria-label={`${label} tarihi ve saati`}
        className="w-auto max-h-[var(--available-height)] overflow-y-auto p-2"
      >
        <Calendar
          mode="single"
          locale={tr}
          timeZone="UTC"
          selected={date}
          defaultMonth={date ?? today}
          today={today}
          autoFocus
          className="[--cell-size:--spacing(9)] [@media(pointer:coarse)]:[--cell-size:--spacing(10)]"
          onSelect={(selected) => {
            if (selected) onChange(`${dateText(selected)} ${clock || "12:00"}`);
          }}
        />
        <div className="mx-2 flex items-center gap-2 border-t py-3">
          <Clock3Icon className="size-4 text-muted-foreground" />
          <label htmlFor={`${id}-time`} className="text-sm">
            Saat
          </label>
          <Input
            id={`${id}-time`}
            aria-label={`${label} saati`}
            disabled={!date}
            inputMode="numeric"
            autoComplete="off"
            placeholder="SS:DD"
            maxLength={5}
            value={date ? clock : ""}
            onChange={(event) => {
              if (date) onChange(`${dateText(date)} ${event.target.value}`);
            }}
            className="ml-auto w-24 text-center"
          />
        </div>
        <div className="mx-2 flex items-center justify-between gap-2 pb-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
          >
            Temizle
          </Button>
          <Button type="button" size="sm" onClick={() => setOpen(false)}>
            Tamam
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
