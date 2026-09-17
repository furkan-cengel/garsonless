'use client'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
export function MenuBulkSelect({ id, value, options, onChange, label }: {
  id: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void; label?: string
}) {
  return <Select items={options} value={value} onValueChange={next => { if (next !== null) onChange(next) }}>
    <SelectTrigger id={id} aria-label={label} className="w-full"><SelectValue /></SelectTrigger>
    <SelectContent alignItemWithTrigger={false}><SelectGroup>{options.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectGroup></SelectContent>
  </Select>
}
