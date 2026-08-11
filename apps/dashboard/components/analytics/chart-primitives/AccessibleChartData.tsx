import type { ReactNode } from 'react'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table'

export interface AccessibleChartColumn<Row> {
  key: keyof Row
  label: string
  align?: 'left' | 'right'
  render?: (value: Row[keyof Row], row: Row) => ReactNode
}

export default function AccessibleChartData<Row extends object>({
  caption,
  summary,
  columns,
  rows,
}: {
  caption: string
  summary: string
  columns: Array<AccessibleChartColumn<Row>>
  rows: Row[]
}) {
  return (
    <div className="analytics-chart-data">
      <p style={{ margin: '8px 0 0', color: 'var(--text-3)', fontSize: 11.5, lineHeight: 1.5 }}>
        {summary}
      </p>
      <details>
        <summary>Veri tablosunu göster</summary>
        <div
          className="analytics-chart-data-region"
          role="region"
          aria-label={`${caption} veri tablosu`}
          tabIndex={0}
        >
          <Table className="min-w-[460px] text-xs">
            <TableCaption className="sr-only">{caption}</TableCaption>
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <TableHead
                    key={String(column.key)}
                    scope="col"
                    className={column.align === 'right' ? 'text-right' : undefined}
                  >
                    {column.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, rowIndex) => (
                <TableRow key={rowIndex}>
                  {columns.map((column) => (
                    <TableCell
                      key={String(column.key)}
                      className={column.align === 'right' ? 'text-right' : undefined}
                    >
                      {column.render ? column.render(row[column.key], row) : String(row[column.key] ?? '')}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </details>
    </div>
  )
}
