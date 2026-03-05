import React from 'react'
import { Column, SortRule, FilterRule, PivotConfig } from '../types'
import { Database, Filter, ArrowUpDown, Table2, ChevronRight } from 'lucide-react'

interface PipelineViewProps {
  sortRules: SortRule[]
  filterRules: FilterRule[]
  pivotConfig: PivotConfig | null
  columns: Column[]
  totalRows: number
  filteredRows: number
  displayRows: number
}

export function PipelineView({
  sortRules, filterRules, pivotConfig, columns, totalRows, filteredRows, displayRows,
}: PipelineViewProps) {
  const activeFilters = filterRules.filter(f => f.enabled)

  const steps = [
    {
      label: 'Source',
      icon: <Database size={14} />,
      detail: `${totalRows} rows × ${columns.length} cols`,
      color: 'text-ds-accent',
      active: true,
    },
    ...(activeFilters.length > 0 ? [{
      label: 'Filter',
      icon: <Filter size={14} />,
      detail: `${activeFilters.length} rule${activeFilters.length > 1 ? 's' : ''} → ${filteredRows} rows`,
      color: 'text-ds-green',
      active: true,
    }] : []),
    ...(sortRules.length > 0 ? [{
      label: 'Sort',
      icon: <ArrowUpDown size={14} />,
      detail: sortRules.map(r => {
        const col = columns.find(c => c.id === r.columnId)
        return `${col?.name ?? '?'} ${r.direction}`
      }).join(', '),
      color: 'text-ds-orange',
      active: true,
    }] : []),
    ...(pivotConfig?.enabled ? [{
      label: 'Pivot',
      icon: <Table2 size={14} />,
      detail: `${pivotConfig.rowFields.length} groups, ${pivotConfig.valueFields.length} aggs → ${displayRows} rows`,
      color: 'text-ds-purple',
      active: true,
    }] : []),
  ]

  return (
    <div className="w-56 border-r border-ds-border bg-ds-surface flex flex-col shrink-0 animate-fade-in">
      <div className="px-3 py-2 border-b border-ds-border">
        <span className="text-[10px] uppercase tracking-wider text-ds-textMuted font-semibold">Pipeline</span>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <div className="space-y-1">
          {steps.map((step, i) => (
            <React.Fragment key={i}>
              {i > 0 && (
                <div className="flex justify-center py-0.5">
                  <ChevronRight size={12} className="text-ds-textMuted/40 rotate-90" />
                </div>
              )}
              <div className={`rounded-lg border p-2.5 transition-colors ${
                step.active
                  ? 'border-ds-border bg-ds-surface2'
                  : 'border-ds-border/50 bg-ds-bg opacity-50'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={step.color}>{step.icon}</span>
                  <span className="text-xs font-semibold text-ds-text">{step.label}</span>
                </div>
                <p className="text-[10px] text-ds-textMuted font-mono leading-relaxed">{step.detail}</p>
              </div>
            </React.Fragment>
          ))}
        </div>

        {/* Code representation */}
        <div className="mt-4 pt-3 border-t border-ds-border">
          <span className="text-[10px] uppercase tracking-wider text-ds-textMuted font-semibold block mb-2">
            As Code
          </span>
          <pre className="bg-ds-bg border border-ds-border rounded p-2 text-[9px] font-mono text-ds-green overflow-x-auto whitespace-pre-wrap leading-relaxed">
            {generatePipelineCode(sortRules, filterRules, pivotConfig, columns)}
          </pre>
        </div>
      </div>
    </div>
  )
}

function generatePipelineCode(
  sortRules: SortRule[], filterRules: FilterRule[],
  pivotConfig: PivotConfig | null, columns: Column[]
): string {
  let code = 'data'
  const activeFilters = filterRules.filter(f => f.enabled)

  if (activeFilters.length > 0) {
    const filterExprs = activeFilters.map(f => {
      const col = columns.find(c => c.id === f.columnId)
      const name = col?.name ?? '?'
      const opMap: Record<string, string> = {
        equals: '==', not_equals: '!=', contains: 'contains',
        greater_than: '>', less_than: '<', regex: '~',
        greater_equal: '>=', less_equal: '<=',
        starts_with: 'startsWith', ends_with: 'endsWith',
        not_contains: '!contains', is_empty: '== ""', not_empty: '!= ""',
      }
      const op = opMap[f.operator] ?? f.operator
      return `${name} ${op} "${f.value}"`
    })
    code += `\n  .filter(${filterExprs.join(' && ')})`
  }

  if (sortRules.length > 0) {
    const sortExprs = sortRules.map(r => {
      const col = columns.find(c => c.id === r.columnId)
      return `${col?.name ?? '?'} ${r.direction}`
    })
    code += `\n  .sort(${sortExprs.join(', ')})`
  }

  if (pivotConfig?.enabled) {
    const rowNames = pivotConfig.rowFields.map(f => columns.find(c => c.id === f)?.name ?? f)
    const valExprs = pivotConfig.valueFields.map(vf => {
      const name = columns.find(c => c.id === vf.columnId)?.name ?? vf.columnId
      return `${vf.aggregation}(${name})`
    })
    code += `\n  .pivot({\n    rows: [${rowNames.join(', ')}],\n    values: [${valExprs.join(', ')}]\n  })`
  }

  return code
}
