import type { ReactNode } from 'react'

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
          <table style={{ width: '100%', minWidth: 460, borderCollapse: 'collapse', fontSize: 11.5 }}>
            <caption className="sr-only">{caption}</caption>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th
                    key={String(column.key)}
                    scope="col"
                    style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', color: 'var(--text-3)', textAlign: column.align ?? 'left', whiteSpace: 'nowrap' }}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {columns.map((column) => (
                    <td
                      key={String(column.key)}
                      style={{ padding: '8px 10px', borderBottom: '1px solid var(--divider)', color: 'var(--text)', textAlign: column.align ?? 'left', whiteSpace: 'nowrap' }}
                    >
                      {column.render ? column.render(row[column.key], row) : String(row[column.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
