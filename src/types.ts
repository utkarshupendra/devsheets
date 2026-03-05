export type CellValue = string | number | boolean | null

export interface Column {
  id: string
  name: string
  type: 'string' | 'number' | 'boolean' | 'date'
  width: number
}

export interface Row {
  id: string
  cells: Record<string, CellValue>
}

export type SortDirection = 'asc' | 'desc'

export interface SortRule {
  columnId: string
  direction: SortDirection
}

export interface FilterRule {
  id: string
  columnId: string
  operator: FilterOperator
  value: string
  enabled: boolean
}

export type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'less_than'
  | 'greater_equal'
  | 'less_equal'
  | 'is_empty'
  | 'not_empty'
  | 'regex'

export interface PivotConfig {
  rowFields: string[]
  colFields: string[]
  valueFields: PivotValueField[]
  enabled: boolean
}

export interface PivotValueField {
  columnId: string
  aggregation: 'sum' | 'count' | 'avg' | 'min' | 'max'
}

export interface PipelineStep {
  id: string
  type: 'source' | 'filter' | 'sort' | 'group' | 'pivot'
  label: string
  config: any
  enabled: boolean
}

export interface Sheet {
  id: string
  name: string
  columns: Column[]
  rows: Row[]
  sortRules: SortRule[]
  filterRules: FilterRule[]
  pivotConfig: PivotConfig | null
  pipeline: PipelineStep[]
  selectedCell: { row: number; col: number } | null
  selectionRange: { startRow: number; startCol: number; endRow: number; endCol: number } | null
}

export interface AppState {
  sheets: Sheet[]
  activeSheetId: string
  commandPaletteOpen: boolean
  filterBarExpression: string
  showPipeline: boolean
  theme: 'dark' | 'light'
}
