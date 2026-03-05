import { CellValue, Column, Row, SortRule, FilterRule, FilterOperator } from '../types'
import * as XLSX from 'xlsx'

let idCounter = 0
const idBase = Date.now().toString(36)
export function generateId(): string {
  return `${idBase}_${(++idCounter).toString(36)}`
}

export function inferColumnType(values: CellValue[]): Column['type'] {
  const sample = values.filter(v => v !== null && v !== '').slice(0, 50)
  if (sample.length === 0) return 'string'

  const numCount = sample.filter(v => !isNaN(Number(v))).length
  if (numCount / sample.length > 0.8) return 'number'

  const boolCount = sample.filter(v =>
    typeof v === 'boolean' || v === 'true' || v === 'false'
  ).length
  if (boolCount / sample.length > 0.8) return 'boolean'

  const dateCount = sample.filter(v => !isNaN(Date.parse(String(v)))).length
  if (dateCount / sample.length > 0.8) return 'date'

  return 'string'
}

export function parseCSV(text: string): { columns: Column[]; rows: Row[] } {
  const lines = text.trim().split('\n')
  if (lines.length === 0) return { columns: [], rows: [] }

  // Only check first 200 chars for delimiter to avoid scanning entire file
  const snippet = text.slice(0, 200)
  const delimiter = snippet.includes('\t') ? '\t' : ','
  const headers = parseCSVLine(lines[0], delimiter)

  // Parse all raw rows first
  const rawRows: string[][] = new Array(lines.length - 1)
  for (let i = 1; i < lines.length; i++) {
    rawRows[i - 1] = parseCSVLine(lines[i], delimiter)
  }

  // Infer column types from a sample (first 50 non-empty values per column)
  const colCount = headers.length
  const colTypes: Column['type'][] = new Array(colCount)
  const sampleSize = Math.min(50, rawRows.length)

  for (let c = 0; c < colCount; c++) {
    const sample: CellValue[] = []
    for (let r = 0; r < sampleSize && sample.length < 50; r++) {
      const v = rawRows[r]?.[c]
      if (v !== undefined && v !== null && v !== '') sample.push(v)
    }
    colTypes[c] = inferColumnType(sample)
  }

  const columns: Column[] = headers.map((name, i) => ({
    id: generateId(),
    name: name.trim(),
    type: colTypes[i],
    width: Math.max(100, Math.min(300, name.length * 10 + 40)),
  }))

  // Build rows with typed cells
  const rows: Row[] = new Array(rawRows.length)
  for (let r = 0; r < rawRows.length; r++) {
    const rawRow = rawRows[r]
    const cells: Record<string, CellValue> = {}
    for (let c = 0; c < colCount; c++) {
      const col = columns[c]
      let val: CellValue = rawRow[c] ?? null
      if (col.type === 'number' && val !== null && val !== '') {
        const num = Number(val)
        val = isNaN(num) ? val : num
      } else if (col.type === 'boolean') {
        val = String(val) === 'true'
      }
      cells[col.id] = val
    }
    rows[r] = { id: generateId(), cells }
  }

  return { columns, rows }
}

function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}

export function parseJSON(text: string): { columns: Column[]; rows: Row[] } {
  const data = JSON.parse(text)
  const arr = Array.isArray(data) ? data : [data]
  if (arr.length === 0) return { columns: [], rows: [] }

  const allKeys = new Set<string>()
  arr.forEach(obj => {
    if (typeof obj === 'object' && obj !== null) {
      Object.keys(obj).forEach(k => allKeys.add(k))
    }
  })

  const keys = Array.from(allKeys)
  const columns: Column[] = keys.map(key => {
    const values = arr.map(obj => obj?.[key] ?? null)
    return {
      id: generateId(),
      name: key,
      type: inferColumnType(values),
      width: Math.max(100, Math.min(300, key.length * 10 + 40)),
    }
  })

  const rows: Row[] = arr.map(obj => {
    const cells: Record<string, CellValue> = {}
    columns.forEach(col => {
      cells[col.id] = obj?.[col.name] ?? null
    })
    return { id: generateId(), cells }
  })

  return { columns, rows }
}

export function parseXLSX(buffer: ArrayBuffer): { columns: Column[]; rows: Row[] }[] {
  const wb = XLSX.read(buffer, { type: 'array' })
  return wb.SheetNames.map(name => {
    const ws = wb.Sheets[name]
    const jsonData: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: null })
    if (jsonData.length === 0) return { columns: [], rows: [] }

    const keys = Object.keys(jsonData[0])
    const columns: Column[] = keys.map(key => {
      const values = jsonData.map(obj => (obj[key] ?? null) as CellValue)
      return {
        id: generateId(),
        name: key,
        type: inferColumnType(values),
        width: Math.max(100, Math.min(300, key.length * 10 + 40)),
      }
    })

    const rows: Row[] = jsonData.map(obj => {
      const cells: Record<string, CellValue> = {}
      columns.forEach(col => {
        const raw = obj[col.name]
        let val: CellValue = raw === undefined || raw === null ? null : raw as CellValue
        if (col.type === 'number' && val !== null && val !== '') {
          const num = Number(val)
          val = isNaN(num) ? val : num
        }
        cells[col.id] = val
      })
      return { id: generateId(), cells }
    })

    return { columns, rows }
  })
}

export function applySortRules(rows: Row[], sortRules: SortRule[], columns: Column[]): Row[] {
  if (sortRules.length === 0) return rows

  return [...rows].sort((a, b) => {
    for (const rule of sortRules) {
      const col = columns.find(c => c.id === rule.columnId)
      if (!col) continue

      const aVal = a.cells[rule.columnId]
      const bVal = b.cells[rule.columnId]

      let comparison = 0
      if (aVal === null && bVal === null) comparison = 0
      else if (aVal === null) comparison = 1
      else if (bVal === null) comparison = -1
      else if (col.type === 'number') {
        comparison = Number(aVal) - Number(bVal)
      } else {
        comparison = String(aVal).localeCompare(String(bVal))
      }

      if (comparison !== 0) {
        return rule.direction === 'asc' ? comparison : -comparison
      }
    }
    return 0
  })
}

export function evaluateFilter(value: CellValue, operator: FilterOperator, filterValue: string): boolean {
  const strVal = value === null ? '' : String(value)
  const numVal = Number(value)
  const filterNum = Number(filterValue)

  switch (operator) {
    case 'equals': return strVal.toLowerCase() === filterValue.toLowerCase()
    case 'not_equals': return strVal.toLowerCase() !== filterValue.toLowerCase()
    case 'contains': return strVal.toLowerCase().includes(filterValue.toLowerCase())
    case 'not_contains': return !strVal.toLowerCase().includes(filterValue.toLowerCase())
    case 'starts_with': return strVal.toLowerCase().startsWith(filterValue.toLowerCase())
    case 'ends_with': return strVal.toLowerCase().endsWith(filterValue.toLowerCase())
    case 'greater_than': return !isNaN(numVal) && !isNaN(filterNum) && numVal > filterNum
    case 'less_than': return !isNaN(numVal) && !isNaN(filterNum) && numVal < filterNum
    case 'greater_equal': return !isNaN(numVal) && !isNaN(filterNum) && numVal >= filterNum
    case 'less_equal': return !isNaN(numVal) && !isNaN(filterNum) && numVal <= filterNum
    case 'is_empty': return strVal === ''
    case 'not_empty': return strVal !== ''
    case 'regex':
      try { return new RegExp(filterValue, 'i').test(strVal) }
      catch { return false }
    default: return true
  }
}

export function applyFilterRules(rows: Row[], filterRules: FilterRule[]): Row[] {
  const activeFilters = filterRules.filter(f => f.enabled)
  if (activeFilters.length === 0) return rows

  return rows.filter(row =>
    activeFilters.every(filter =>
      evaluateFilter(row.cells[filter.columnId], filter.operator, filter.value)
    )
  )
}

export function parseFilterExpression(expression: string, columns: Column[]): FilterRule[] {
  const rules: FilterRule[] = []
  if (!expression.trim()) return rules

  const operatorPattern = /\s*(~|==|!=|>=|<=|>|<|contains|starts_with|ends_with)\s*/
  const parts = expression.split(/\s*&&\s*/)

  // Sort columns by name length descending so longer names match first
  const sortedCols = [...columns].sort((a, b) => b.name.length - a.name.length)

  for (const part of parts) {
    const trimmed = part.trim()

    // Try quoted column name first: "Column Name" op value
    let match = trimmed.match(/^["'`](.+?)["'`]\s*(~|==|!=|>=|<=|>|<|contains|starts_with|ends_with)\s*(.+)$/)

    let col: Column | undefined
    let op: string
    let val: string

    if (match) {
      const [, colName, matchOp, matchVal] = match
      col = columns.find(c => c.name.toLowerCase() === colName.toLowerCase())
      op = matchOp
      val = matchVal
    } else {
      // Try to match unquoted column names by testing each known column name
      let found = false
      for (const c of sortedCols) {
        const nameLower = c.name.toLowerCase()
        const partLower = trimmed.toLowerCase()
        if (partLower.startsWith(nameLower)) {
          const rest = trimmed.slice(c.name.length)
          const opMatch = rest.match(/^\s*(~|==|!=|>=|<=|>|<|contains|starts_with|ends_with)\s*(.+)$/)
          if (opMatch) {
            col = c
            op = opMatch[1]
            val = opMatch[2]
            found = true
            break
          }
        }
      }
      if (!found) {
        // Fallback: single-word column name
        const fallback = trimmed.match(/^(\w+)\s*(~|==|!=|>=|<=|>|<|contains|starts_with|ends_with)\s*(.+)$/)
        if (!fallback) continue
        const [, colName, matchOp, matchVal] = fallback
        col = columns.find(c => c.name.toLowerCase() === colName.toLowerCase())
        op = matchOp
        val = matchVal
      }
    }

    if (!col) continue

    const cleanVal = val!.replace(/^["'/]|["'/]$/g, '')
    let operator: FilterOperator = 'equals'
    switch (op!) {
      case '==': operator = 'equals'; break
      case '!=': operator = 'not_equals'; break
      case '>': operator = 'greater_than'; break
      case '<': operator = 'less_than'; break
      case '>=': operator = 'greater_equal'; break
      case '<=': operator = 'less_equal'; break
      case '~': operator = 'regex'; break
      case 'contains': operator = 'contains'; break
      case 'starts_with': operator = 'starts_with'; break
      case 'ends_with': operator = 'ends_with'; break
    }

    rules.push({
      id: generateId(),
      columnId: col.id,
      operator,
      value: cleanVal,
      enabled: true,
    })
  }

  return rules
}

export function computePivot(
  rows: Row[],
  columns: Column[],
  config: {
    rowFields: string[]
    colFields: string[]
    valueFields: { columnId: string; aggregation: 'sum' | 'count' | 'avg' | 'min' | 'max' }[]
  }
): { pivotColumns: Column[]; pivotRows: Row[] } {
  if (config.rowFields.length === 0 || config.valueFields.length === 0) {
    return { pivotColumns: [], pivotRows: [] }
  }

  const groups = new Map<string, Row[]>()
  for (const row of rows) {
    const key = config.rowFields.map(f => String(row.cells[f] ?? '')).join('||')
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(row)
  }

  const pivotColumns: Column[] = [
    ...config.rowFields.map(f => {
      const srcCol = columns.find(c => c.id === f)!
      return { id: f, name: srcCol?.name ?? f, type: 'string' as const, width: 150 }
    }),
    ...config.valueFields.map(vf => {
      const srcCol = columns.find(c => c.id === vf.columnId)!
      return {
        id: `${vf.columnId}_${vf.aggregation}`,
        name: `${vf.aggregation.toUpperCase()}(${srcCol?.name ?? vf.columnId})`,
        type: 'number' as const,
        width: 150,
      }
    }),
  ]

  const pivotRows: Row[] = []
  for (const [, groupRows] of groups) {
    const cells: Record<string, CellValue> = {}

    for (const f of config.rowFields) {
      cells[f] = groupRows[0].cells[f]
    }

    for (const vf of config.valueFields) {
      const vals = groupRows.map(r => Number(r.cells[vf.columnId] ?? 0)).filter(n => !isNaN(n))
      const key = `${vf.columnId}_${vf.aggregation}`
      switch (vf.aggregation) {
        case 'sum': cells[key] = vals.reduce((a, b) => a + b, 0); break
        case 'count': cells[key] = vals.length; break
        case 'avg': cells[key] = vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100 : 0; break
        case 'min': cells[key] = vals.length ? Math.min(...vals) : 0; break
        case 'max': cells[key] = vals.length ? Math.max(...vals) : 0; break
      }
    }

    pivotRows.push({ id: generateId(), cells })
  }

  return { pivotColumns, pivotRows }
}

export function generateSampleData(): { columns: Column[]; rows: Row[] } {
  const cols: Column[] = [
    { id: generateId(), name: 'name', type: 'string', width: 180 },
    { id: generateId(), name: 'language', type: 'string', width: 120 },
    { id: generateId(), name: 'stars', type: 'number', width: 100 },
    { id: generateId(), name: 'forks', type: 'number', width: 100 },
    { id: generateId(), name: 'issues', type: 'number', width: 100 },
    { id: generateId(), name: 'license', type: 'string', width: 120 },
    { id: generateId(), name: 'last_commit', type: 'date', width: 140 },
  ]

  const repos = [
    ['react', 'JavaScript', 220000, 45000, 1200, 'MIT', '2024-01-15'],
    ['vue', 'TypeScript', 210000, 34000, 580, 'MIT', '2024-01-14'],
    ['angular', 'TypeScript', 93000, 25000, 1500, 'MIT', '2024-01-13'],
    ['svelte', 'JavaScript', 75000, 3800, 850, 'MIT', '2024-01-12'],
    ['next.js', 'TypeScript', 118000, 26000, 2300, 'MIT', '2024-01-15'],
    ['nuxt', 'TypeScript', 51000, 4700, 920, 'MIT', '2024-01-11'],
    ['remix', 'TypeScript', 27000, 2200, 430, 'MIT', '2024-01-10'],
    ['astro', 'TypeScript', 40000, 2100, 310, 'MIT', '2024-01-14'],
    ['solid', 'TypeScript', 30000, 830, 120, 'MIT', '2024-01-09'],
    ['preact', 'JavaScript', 36000, 1900, 170, 'MIT', '2024-01-08'],
    ['lit', 'TypeScript', 17000, 900, 240, 'BSD-3', '2024-01-07'],
    ['htmx', 'JavaScript', 28000, 980, 190, 'BSD-2', '2024-01-13'],
    ['alpine.js', 'JavaScript', 26000, 1100, 50, 'MIT', '2024-01-06'],
    ['qwik', 'TypeScript', 20000, 1300, 410, 'MIT', '2024-01-12'],
    ['ember', 'JavaScript', 22000, 4300, 320, 'MIT', '2024-01-05'],
    ['backbone', 'JavaScript', 28000, 5600, 80, 'MIT', '2023-12-20'],
    ['express', 'JavaScript', 63000, 15000, 180, 'MIT', '2024-01-10'],
    ['fastify', 'JavaScript', 30000, 2200, 95, 'MIT', '2024-01-14'],
    ['nestjs', 'TypeScript', 63000, 7400, 110, 'MIT', '2024-01-15'],
    ['deno', 'Rust', 93000, 5100, 1800, 'MIT', '2024-01-15'],
    ['bun', 'Zig', 68000, 2500, 950, 'MIT', '2024-01-14'],
    ['vite', 'TypeScript', 63000, 5600, 470, 'MIT', '2024-01-15'],
    ['webpack', 'JavaScript', 64000, 8700, 230, 'MIT', '2024-01-09'],
    ['esbuild', 'Go', 37000, 1100, 410, 'MIT', '2024-01-11'],
    ['tailwindcss', 'JavaScript', 77000, 3900, 60, 'MIT', '2024-01-14'],
    ['prisma', 'TypeScript', 36000, 1300, 3200, 'Apache-2.0', '2024-01-15'],
    ['drizzle-orm', 'TypeScript', 19000, 450, 520, 'Apache-2.0', '2024-01-13'],
    ['trpc', 'TypeScript', 32000, 1100, 120, 'MIT', '2024-01-12'],
    ['zod', 'TypeScript', 29000, 620, 340, 'MIT', '2024-01-11'],
    ['turborepo', 'Rust', 24000, 1700, 590, 'MPL-2.0', '2024-01-14'],
  ]

  const rows: Row[] = repos.map(r => {
    const cells: Record<string, CellValue> = {}
    cols.forEach((col, i) => { cells[col.id] = r[i] as CellValue })
    return { id: generateId(), cells }
  })

  return { columns: cols, rows }
}

export function rowsToXLSX(rows: Row[], columns: Column[], sheetName = 'Sheet1'): ArrayBuffer {
  const data = rows.map(row => {
    const obj: Record<string, CellValue> = {}
    columns.forEach(col => { obj[col.name] = row.cells[col.id] })
    return obj
  })
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
}

export function rowsToCSV(rows: Row[], columns: Column[]): string {
  const header = columns.map(c => c.name).join(',')
  const body = rows.map(row =>
    columns.map(col => {
      const val = row.cells[col.id]
      if (val === null) return ''
      const str = String(val)
      return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str
    }).join(',')
  ).join('\n')
  return `${header}\n${body}`
}

export function rowsToJSON(rows: Row[], columns: Column[]): string {
  const data = rows.map(row => {
    const obj: Record<string, CellValue> = {}
    columns.forEach(col => { obj[col.name] = row.cells[col.id] })
    return obj
  })
  return JSON.stringify(data, null, 2)
}
