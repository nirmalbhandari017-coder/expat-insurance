/**
 * CSV export.
 *
 * Spreadsheets are the format this data leaves the CRM in, so the escaping has
 * to be right: fields containing a comma, quote or newline are quoted, and
 * embedded quotes are doubled. A leading BOM makes Excel read UTF-8 properly
 * instead of mangling currency symbols and accented names.
 */

function cell(value) {
  if (value == null) return ''
  const s = String(value)
  // Guard against a leading =, +, - or @ being executed as a formula when the
  // file is opened in Excel or Sheets.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/**
 * @param {string} filename
 * @param {{key: string, header: string, format?: (row: any) => any}[]} columns
 * @param {object[]} rows
 */
export function downloadCsv(filename, columns, rows) {
  const head = columns.map((c) => cell(c.header)).join(',')
  const body = rows.map((row) =>
    columns.map((c) => cell(c.format ? c.format(row) : row[c.key])).join(','),
  )
  const csv = '﻿' + [head, ...body].join('\r\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** "expenses-2026-08-04.csv" */
export function stampedName(prefix) {
  return `${prefix}-${new Date().toISOString().slice(0, 10)}.csv`
}
