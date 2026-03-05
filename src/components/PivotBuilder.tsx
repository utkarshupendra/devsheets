import React from 'react'
import { useStore } from '../store'
import { Column, PivotConfig, PivotValueField } from '../types'
import { X, Plus, GripVertical, ToggleLeft, ToggleRight } from 'lucide-react'

interface PivotBuilderProps {
  columns: Column[]
  config: PivotConfig
}

export function PivotBuilder({ columns, config }: PivotBuilderProps) {
  const store = useStore()

  const updateConfig = (updates: Partial<PivotConfig>) => {
    store.setPivotConfig({ ...config, ...updates })
  }

  const addRowField = (colId: string) => {
    if (!config.rowFields.includes(colId)) {
      updateConfig({ rowFields: [...config.rowFields, colId] })
    }
  }

  const removeRowField = (colId: string) => {
    updateConfig({ rowFields: config.rowFields.filter(f => f !== colId) })
  }

  const addValueField = (colId: string, aggregation: PivotValueField['aggregation']) => {
    updateConfig({
      valueFields: [...config.valueFields, { columnId: colId, aggregation }],
    })
  }

  const removeValueField = (index: number) => {
    updateConfig({
      valueFields: config.valueFields.filter((_, i) => i !== index),
    })
  }

  const numericColumns = columns.filter(c => c.type === 'number')
  const availableRowCols = columns.filter(c => !config.rowFields.includes(c.id))

  const codePreview = generateCodePreview(config, columns)

  return (
    <div className="w-72 border-l border-ds-border bg-ds-surface flex flex-col shrink-0 animate-fade-in">
      <div className="flex items-center justify-between px-3 py-2 border-b border-ds-border">
        <span className="text-xs font-semibold text-ds-accent uppercase tracking-wider">Pivot Table</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => updateConfig({ enabled: !config.enabled })}
            className="text-ds-textMuted hover:text-ds-text"
            title={config.enabled ? 'Disable pivot' : 'Enable pivot'}
          >
            {config.enabled ? <ToggleRight size={16} className="text-ds-green" /> : <ToggleLeft size={16} />}
          </button>
          <button
            onClick={() => store.setPivotConfig(null)}
            className="text-ds-textMuted hover:text-ds-red"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Row Fields */}
        <div>
          <label className="text-[10px] uppercase tracking-wider text-ds-textMuted font-semibold block mb-1.5">
            Group By (Rows)
          </label>
          <div className="space-y-1">
            {config.rowFields.map(fieldId => {
              const col = columns.find(c => c.id === fieldId)
              return (
                <div key={fieldId} className="flex items-center gap-1.5 bg-ds-surface2 rounded px-2 py-1.5 group">
                  <GripVertical size={10} className="text-ds-textMuted cursor-grab" />
                  <span className="text-xs font-mono text-ds-text flex-1">{col?.name ?? fieldId}</span>
                  <button onClick={() => removeRowField(fieldId)} className="text-ds-textMuted hover:text-ds-red opacity-0 group-hover:opacity-100">
                    <X size={11} />
                  </button>
                </div>
              )
            })}
          </div>
          {availableRowCols.length > 0 && (
            <select
              onChange={e => { if (e.target.value) addRowField(e.target.value); e.target.value = '' }}
              className="mt-1.5 w-full bg-ds-bg border border-ds-border rounded px-2 py-1 text-xs font-mono text-ds-textMuted outline-none"
              defaultValue=""
            >
              <option value="" disabled>+ Add field...</option>
              {availableRowCols.map(col => (
                <option key={col.id} value={col.id}>{col.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Value Fields */}
        <div>
          <label className="text-[10px] uppercase tracking-wider text-ds-textMuted font-semibold block mb-1.5">
            Values (Aggregations)
          </label>
          <div className="space-y-1">
            {config.valueFields.map((vf, i) => {
              const col = columns.find(c => c.id === vf.columnId)
              return (
                <div key={i} className="flex items-center gap-1.5 bg-ds-orange/10 border border-ds-orange/20 rounded px-2 py-1.5 group">
                  <span className="text-[10px] text-ds-orange font-semibold uppercase">{vf.aggregation}</span>
                  <span className="text-xs font-mono text-ds-text flex-1">({col?.name})</span>
                  <button onClick={() => removeValueField(i)} className="text-ds-textMuted hover:text-ds-red opacity-0 group-hover:opacity-100">
                    <X size={11} />
                  </button>
                </div>
              )
            })}
          </div>
          {numericColumns.length > 0 && (
            <div className="mt-1.5 flex gap-1">
              <select
                id="pivot-val-col"
                className="flex-1 bg-ds-bg border border-ds-border rounded px-2 py-1 text-xs font-mono text-ds-textMuted outline-none"
                defaultValue=""
              >
                <option value="" disabled>Column...</option>
                {numericColumns.map(col => (
                  <option key={col.id} value={col.id}>{col.name}</option>
                ))}
              </select>
              <select
                id="pivot-val-agg"
                className="bg-ds-bg border border-ds-border rounded px-2 py-1 text-xs font-mono text-ds-textMuted outline-none"
                defaultValue="sum"
              >
                <option value="sum">SUM</option>
                <option value="count">COUNT</option>
                <option value="avg">AVG</option>
                <option value="min">MIN</option>
                <option value="max">MAX</option>
              </select>
              <button
                onClick={() => {
                  const colEl = document.getElementById('pivot-val-col') as HTMLSelectElement
                  const aggEl = document.getElementById('pivot-val-agg') as HTMLSelectElement
                  if (colEl.value) {
                    addValueField(colEl.value, aggEl.value as PivotValueField['aggregation'])
                    colEl.value = ''
                  }
                }}
                className="bg-ds-accent/15 text-ds-accent rounded px-2 py-1 hover:bg-ds-accent/25 transition-colors"
              >
                <Plus size={12} />
              </button>
            </div>
          )}
        </div>

        {/* Code Preview */}
        <div>
          <label className="text-[10px] uppercase tracking-wider text-ds-textMuted font-semibold block mb-1.5">
            Code Preview
          </label>
          <pre className="bg-ds-bg border border-ds-border rounded p-2 text-[10px] font-mono text-ds-green overflow-x-auto whitespace-pre-wrap">
            {codePreview}
          </pre>
        </div>
      </div>
    </div>
  )
}

function generateCodePreview(config: PivotConfig, columns: Column[]): string {
  const rowNames = config.rowFields.map(f => columns.find(c => c.id === f)?.name ?? f)
  const valExprs = config.valueFields.map(vf => {
    const name = columns.find(c => c.id === vf.columnId)?.name ?? vf.columnId
    return `  ${vf.aggregation}('${name}')`
  })

  return `pivot({
  rows: [${rowNames.map(n => `'${n}'`).join(', ')}],
  values: [
${valExprs.join(',\n')}
  ]
})`
}
