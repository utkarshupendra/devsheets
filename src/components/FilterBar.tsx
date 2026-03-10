import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useStore } from '../store'
import { FilterOperator, Column, Row } from '../types'
import { parseFilterExpression, getColumnAliases } from '../lib/utils'
import { Search, X, ToggleLeft, ToggleRight, ChevronDown } from 'lucide-react'

const OPERATORS: { value: FilterOperator; label: string; symbol: string }[] = [
  { value: 'equals', label: 'Equals', symbol: '==' },
  { value: 'not_equals', label: 'Not equals', symbol: '!=' },
  { value: 'contains', label: 'Contains', symbol: '⊃' },
  { value: 'not_contains', label: 'Not contains', symbol: '⊅' },
  { value: 'starts_with', label: 'Starts with', symbol: '^' },
  { value: 'ends_with', label: 'Ends with', symbol: '$' },
  { value: 'greater_than', label: 'Greater than', symbol: '>' },
  { value: 'less_than', label: 'Less than', symbol: '<' },
  { value: 'greater_equal', label: 'Greater or equal', symbol: '>=' },
  { value: 'less_equal', label: 'Less or equal', symbol: '<=' },
  { value: 'is_empty', label: 'Is empty', symbol: '∅' },
  { value: 'not_empty', label: 'Not empty', symbol: '!∅' },
  { value: 'regex', label: 'Regex', symbol: '~' },
  { value: 'in', label: 'In list', symbol: 'in' },
  { value: 'not_in', label: 'Not in list', symbol: 'not in' },
]

const OP_SYMBOLS = ['==', '!=', '>=', '<=', '>', '<', '~', 'not in', 'in', 'contains', 'starts_with', 'ends_with']

type SuggestionKind = 'column' | 'operator' | 'value'
interface Suggestion { kind: SuggestionKind; text: string; detail?: string }

function getUniqueValues(rows: Row[], colId: string, limit = 50): string[] {
  const seen = new Set<string>()
  for (const row of rows) {
    const v = row.cells[colId]
    if (v === null || v === undefined || v === '') continue
    seen.add(String(v))
    if (seen.size >= limit) break
  }
  return Array.from(seen).sort()
}

export function FilterBar() {
  const store = useStore()
  const sheet = store.sheets.find(s => s.id === store.activeSheetId)!
  const [expressionMode, setExpressionMode] = useState(false)
  const [expression, setExpression] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  const handleExpressionSubmit = () => {
    if (!expression.trim()) return
    const rules = parseFilterExpression(expression, sheet.columns, sheet.rows)
    if (rules.length > 0) {
      store.setFilterRules([...sheet.filterRules, ...rules])
      setExpression('')
      setShowSuggestions(false)
    }
  }

  // Build alias map: row-1 values → columns (original header names)
  const aliasMap = useMemo(() => getColumnAliases(sheet.columns, sheet.rows), [sheet.columns, sheet.rows])

  // Determine what kind of suggestion to show based on cursor context
  const suggestions = useMemo((): Suggestion[] => {
    // Build combined name entries: letter columns + aliases from row 1
    type NameEntry = { displayText: string; insertText: string; col: Column; detail: string }
    const nameEntries: NameEntry[] = []
    sheet.columns.forEach(c => {
      // Find alias (row-1 value) for this column
      let alias = ''
      aliasMap.forEach((mappedCol, key) => {
        if (mappedCol.id === c.id) alias = key
      })
      if (alias) {
        // Show alias as primary suggestion with letter as detail
        nameEntries.push({ displayText: alias, insertText: alias, col: c, detail: c.name })
        nameEntries.push({ displayText: c.name, insertText: c.name, col: c, detail: alias })
      } else {
        nameEntries.push({ displayText: c.name, insertText: c.name, col: c, detail: c.type })
      }
    })

    if (!expression) {
      // Show all column names when empty — prefer aliases
      const seen = new Set<string>()
      const results: Suggestion[] = []
      nameEntries.forEach(e => {
        if (!seen.has(e.col.id)) {
          seen.add(e.col.id)
          results.push({ kind: 'column' as const, text: e.insertText, detail: e.detail })
        }
      })
      return results
    }

    // Get the last segment (after the last &&)
    const parts = expression.split(/&&/)
    const lastPart = (parts[parts.length - 1] || '').trimStart()

    // Check if user already typed an operator
    // Sort all name entries by length descending for matching
    const sortedEntries = [...nameEntries].sort((a, b) => b.insertText.length - a.insertText.length)
    let matchedCol: Column | undefined
    let afterCol = ''

    // Try quoted column name
    const quotedMatch = lastPart.match(/^["'`](.+?)["'`]\s*(.*)$/)
    if (quotedMatch) {
      const entry = nameEntries.find(e => e.insertText.toLowerCase() === quotedMatch[1].toLowerCase())
      matchedCol = entry?.col
      afterCol = quotedMatch[2]
    } else {
      // Try unquoted column name match (including aliases)
      for (const entry of sortedEntries) {
        if (lastPart.toLowerCase().startsWith(entry.insertText.toLowerCase())) {
          const rest = lastPart.slice(entry.insertText.length)
          if (rest === '' || rest.match(/^\s/)) {
            matchedCol = entry.col
            afterCol = rest.trim()
            break
          }
        }
      }
    }

    if (!matchedCol) {
      // Suggest column names/aliases that match what's typed
      const typed = lastPart.toLowerCase()
      const seen = new Set<string>()
      const results: Suggestion[] = []
      nameEntries.forEach(e => {
        if (e.insertText.toLowerCase().includes(typed) && !seen.has(e.insertText.toLowerCase())) {
          seen.add(e.insertText.toLowerCase())
          results.push({ kind: 'column' as const, text: e.insertText, detail: e.detail })
        }
      })
      return results
    }

    // Column matched — check if operator is typed
    let matchedOp = ''
    let afterOp = ''
    for (const op of OP_SYMBOLS.sort((a, b) => b.length - a.length)) {
      if (afterCol.toLowerCase().startsWith(op)) {
        const rest = afterCol.slice(op.length)
        if (rest === '' || rest.match(/^\s/)) {
          matchedOp = op
          afterOp = rest.trim()
          break
        }
      }
    }

    if (!matchedOp) {
      // Suggest operators
      const typed = afterCol.toLowerCase()
      const opSuggestions = OP_SYMBOLS.filter(o => o.startsWith(typed) || typed === '')
      return opSuggestions.map(o => {
        const opDef = OPERATORS.find(d => d.symbol === o)
        return { kind: 'operator' as const, text: o, detail: opDef?.label ?? '' }
      })
    }

    // For 'in' / 'not in' — suggest values inside the parenthesized list
    if (matchedOp === 'in' || matchedOp === 'not in') {
      const uniqueVals = getUniqueValues(sheet.rows, matchedCol.id, 200)
      // Parse already-selected values to exclude them
      const alreadySelected = new Set<string>()
      const parenContent = afterOp.replace(/^\(/, '').replace(/\)$/, '')
      if (parenContent) {
        parenContent.split(',').forEach(v => {
          let t = v.trim()
          if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) t = t.slice(1, -1)
          if (t) alreadySelected.add(t.toLowerCase())
        })
      }
      // Get partial text after the last comma (or after '(')
      const lastCommaIdx = afterOp.lastIndexOf(',')
      const parenIdx = afterOp.indexOf('(')
      let partial = ''
      if (lastCommaIdx >= 0) {
        partial = afterOp.slice(lastCommaIdx + 1).trim().replace(/^["']/, '')
      } else if (parenIdx >= 0) {
        partial = afterOp.slice(parenIdx + 1).trim().replace(/^["']/, '')
      }
      const available = uniqueVals.filter(v => !alreadySelected.has(v.toLowerCase()))
      const filtered = partial ? available.filter(v => v.toLowerCase().includes(partial.toLowerCase())) : available
      return filtered.slice(0, 30).map(v => ({ kind: 'value' as const, text: v }))
    }

    // Operator matched — suggest unique values
    const typed = afterOp.toLowerCase().replace(/^["']/, '')
    const uniqueVals = getUniqueValues(sheet.rows, matchedCol.id, 200)
    const filtered = typed ? uniqueVals.filter(v => v.toLowerCase().includes(typed)) : uniqueVals
    return filtered.slice(0, 30).map(v => ({ kind: 'value' as const, text: v }))
  }, [expression, sheet.columns, sheet.rows])

  useEffect(() => { setSelectedIdx(0) }, [suggestions])

  const applySuggestion = useCallback((suggestion: Suggestion) => {
    const parts = expression.split(/&&/)
    const prefix = parts.length > 1 ? parts.slice(0, -1).join('&&') + '&& ' : ''
    const lastPart = (parts[parts.length - 1] || '').trimStart()

    if (suggestion.kind === 'column') {
      const name = suggestion.text.includes(' ') ? `"${suggestion.text}"` : suggestion.text
      setExpression(prefix + name + ' ')
    } else if (suggestion.kind === 'operator') {
      // Find the column portion and append operator
      const sortedCols = [...sheet.columns].sort((a, b) => b.name.length - a.name.length)
      let colPart = lastPart
      const quotedMatch = lastPart.match(/^(["'`].+?["'`])\s*/)
      if (quotedMatch) {
        colPart = quotedMatch[1]
      } else {
        for (const c of sortedCols) {
          if (lastPart.toLowerCase().startsWith(c.name.toLowerCase())) {
            colPart = lastPart.slice(0, c.name.length)
            break
          }
        }
      }
      const isInOp = suggestion.text === 'in' || suggestion.text === 'not in'
      setExpression(prefix + colPart + ' ' + suggestion.text + (isInOp ? ' (' : ' '))
    } else {
      // Value suggestion
      const quotedVal = /[,\s]/.test(suggestion.text) ? `"${suggestion.text}"` : `"${suggestion.text}"`
      const sortedCols = [...sheet.columns].sort((a, b) => b.name.length - a.name.length)
      let colPart = ''
      let afterCol = lastPart

      const quotedMatch = lastPart.match(/^(["'`].+?["'`])\s*(.*)$/)
      if (quotedMatch) {
        colPart = quotedMatch[1]
        afterCol = quotedMatch[2]
      } else {
        for (const c of sortedCols) {
          if (lastPart.toLowerCase().startsWith(c.name.toLowerCase())) {
            colPart = lastPart.slice(0, c.name.length)
            afterCol = lastPart.slice(c.name.length).trim()
            break
          }
        }
      }

      let opPart = ''
      for (const op of OP_SYMBOLS.sort((a, b) => b.length - a.length)) {
        if (afterCol.toLowerCase().startsWith(op)) {
          opPart = op
          break
        }
      }

      // Handle 'in' / 'not in' — insert value into the parenthesized list, keep paren open
      if (opPart === 'in' || opPart === 'not in') {
        const afterOpStr = afterCol.slice(opPart.length).trim()
        const openParen = afterOpStr.indexOf('(')
        if (openParen >= 0) {
          // Strip existing partial text (after last comma) and closing paren if present
          const inner = afterOpStr.slice(openParen + 1).replace(/\)$/, '')
          const lastComma = inner.lastIndexOf(',')
          const existingPart = lastComma >= 0 ? inner.slice(0, lastComma + 1) + ' ' : ''
          // Leave paren open with trailing ', ' so user can keep adding values
          setExpression(prefix + colPart + ' ' + opPart + ' (' + existingPart + quotedVal + ', ')
        } else {
          setExpression(prefix + colPart + ' ' + opPart + ' (' + quotedVal + ', ')
        }
        // Keep suggestions open so user can add more values (Tab to pick, Enter to submit)
        return
      }

      setExpression(prefix + colPart + ' ' + opPart + ' ' + quotedVal)
      setShowSuggestions(false)
    }
    inputRef.current?.focus()
  }, [expression, sheet.columns])

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIdx(i => Math.min(i + 1, suggestions.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIdx(i => Math.max(i - 1, 0))
        return
      }
      if (e.key === 'Tab' && suggestions[selectedIdx]) {
        e.preventDefault()
        applySuggestion(suggestions[selectedIdx])
        return
      }
    }
    if (e.key === 'Enter') { setShowSuggestions(false); handleExpressionSubmit() }
    if (e.key === 'Escape') { setShowSuggestions(false); if (!expression) setExpressionMode(false) }
  }

  // Scroll selected suggestion into view
  useEffect(() => {
    if (!suggestionsRef.current) return
    const el = suggestionsRef.current.children[selectedIdx] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIdx])

  return (
    <div className="shrink-0">
      {expressionMode && (
        <div className="relative">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-ds-surface2 border-b border-ds-border animate-fade-in">
            <Search size={13} className="text-ds-textMuted shrink-0" />
            <input
              ref={inputRef}
              value={expression}
              onChange={e => { setExpression(e.target.value); setShowSuggestions(true) }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={handleInputKeyDown}
              placeholder='Filter: column operator value (Tab to autocomplete)'
              className="flex-1 bg-transparent text-xs font-mono text-ds-text placeholder-ds-textMuted/50 outline-none"
              autoFocus
            />
            <button
              onClick={() => { setExpressionMode(false); setShowSuggestions(false) }}
              className="text-ds-textMuted hover:text-ds-text"
            >
              <X size={13} />
            </button>
          </div>

          {/* Autocomplete dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute left-8 right-8 top-full z-50 bg-ds-surface border border-ds-border rounded-b shadow-lg max-h-[200px] overflow-y-auto"
            >
              {suggestions.map((s, i) => (
                <button
                  key={s.text + i}
                  className={`w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs font-mono
                    ${i === selectedIdx ? 'bg-ds-accent/15 text-ds-accent' : 'text-ds-text hover:bg-ds-surface2'}`}
                  onMouseDown={(e) => { e.preventDefault(); applySuggestion(s) }}
                  onMouseEnter={() => setSelectedIdx(i)}
                >
                  <span className={`w-[3px] h-3 rounded-full shrink-0 ${
                    s.kind === 'column' ? 'bg-ds-accent' :
                    s.kind === 'operator' ? 'bg-ds-orange' : 'bg-ds-green'
                  }`} />
                  <span className="truncate">{s.text}</span>
                  {s.detail && <span className="ml-auto text-ds-textMuted text-[10px]">{s.detail}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!expressionMode && sheet.filterRules.length === 0 && (
        <button
          onClick={() => setExpressionMode(true)}
          className="w-full flex items-center gap-2 px-3 py-1 bg-ds-surface border-b border-ds-border text-ds-textMuted hover:text-ds-text hover:bg-ds-surface2 transition-colors"
        >
          <Search size={12} />
          <span className="text-[11px] font-mono">Filter: type an expression or use the toolbar...</span>
        </button>
      )}

      {sheet.filterRules.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-3 py-1.5 bg-ds-surface border-b border-ds-border animate-fade-in">
          <span className="text-[10px] uppercase tracking-wider text-ds-textMuted font-semibold mr-1">Filter</span>
          {sheet.filterRules.map(rule => {
            const col = sheet.columns.find(c => c.id === rule.columnId)
            const op = OPERATORS.find(o => o.value === rule.operator)
            // Show original field name (row-1 alias) if available, else fall back to letter
            let colAlias = col?.name ?? '?'
            if (col) {
              aliasMap.forEach((mappedCol, key) => {
                if (mappedCol.id === col.id) colAlias = key
              })
            }
            return (
              <FilterChip
                key={rule.id}
                ruleId={rule.id}
                columnName={colAlias}
                columnId={rule.columnId}
                operator={op?.symbol ?? rule.operator}
                operatorValue={rule.operator}
                value={rule.value}
                enabled={rule.enabled}
                onToggle={() => store.toggleFilterRule(rule.id)}
                onRemove={() => store.removeFilterRule(rule.id)}
                onChangeColumn={(colId) => store.updateFilterRule(rule.id, { columnId: colId })}
                onChangeOperator={(op) => store.updateFilterRule(rule.id, { operator: op })}
                onChangeValue={(val) => store.updateFilterRule(rule.id, { value: val })}
                columns={sheet.columns}
                rows={sheet.rows}
              />
            )
          })}
          <button
            onClick={() => setExpressionMode(true)}
            className="text-ds-accent text-[10px] hover:text-ds-accentHover ml-1"
          >
            + expression
          </button>
          <button
            onClick={() => store.clearFilterRules()}
            className="text-[10px] text-ds-textMuted hover:text-ds-red ml-2 transition-colors"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  )
}

function FilterChip({
  ruleId, columnName, columnId, operator, operatorValue, value, enabled, onToggle, onRemove,
  onChangeColumn, onChangeOperator, onChangeValue, columns, rows,
}: {
  ruleId: string
  columnName: string
  columnId: string
  operator: string
  operatorValue: FilterOperator
  value: string
  enabled: boolean
  onToggle: () => void
  onRemove: () => void
  onChangeColumn: (colId: string) => void
  onChangeOperator: (op: FilterOperator) => void
  onChangeValue: (val: string) => void
  columns: Column[]
  rows: Row[]
}) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  const [showValues, setShowValues] = useState(false)
  const [valueFilter, setValueFilter] = useState('')
  const chipRef = useRef<HTMLDivElement>(null)
  const valueInputRef = useRef<HTMLInputElement>(null)

  const uniqueValues = useMemo(() => {
    return getUniqueValues(rows, columnId, 200)
  }, [rows, columnId])

  const filteredValues = useMemo(() => {
    if (!valueFilter) return uniqueValues.slice(0, 30)
    const q = valueFilter.toLowerCase()
    return uniqueValues.filter(v => v.toLowerCase().includes(q)).slice(0, 30)
  }, [uniqueValues, valueFilter])

  // Close dropdown on outside click
  useEffect(() => {
    if (!showValues) return
    const handleClick = (e: MouseEvent) => {
      if (chipRef.current && !chipRef.current.contains(e.target as Node)) {
        setShowValues(false)
      }
    }
    window.addEventListener('mousedown', handleClick)
    return () => window.removeEventListener('mousedown', handleClick)
  }, [showValues])

  const startEditing = () => {
    setEditing(true)
    setEditValue(value)
    setShowValues(true)
    setValueFilter('')
  }

  const commitValue = (val: string) => {
    onChangeValue(val)
    setEditing(false)
    setShowValues(false)
    setEditValue(val)
  }

  return (
    <div ref={chipRef} className={`relative flex items-center gap-1 rounded px-2 py-1 text-xs group transition-opacity
      ${enabled
        ? 'bg-ds-green/10 border border-ds-green/25 text-ds-green'
        : 'bg-ds-surface2 border border-ds-border text-ds-textMuted opacity-60'
      }`}
    >
      <button onClick={onToggle} className="shrink-0">
        {enabled ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
      </button>
      <span className="font-mono font-medium">{columnName}</span>
      <span className="text-ds-textMuted">{operator}</span>
      {editing ? (
        <input
          ref={valueInputRef}
          value={editValue}
          onChange={e => { setEditValue(e.target.value); setValueFilter(e.target.value); setShowValues(true) }}
          onBlur={() => { setTimeout(() => { if (!showValues) commitValue(editValue) }, 150) }}
          onKeyDown={e => {
            if (e.key === 'Enter') commitValue(editValue)
            if (e.key === 'Escape') { setEditing(false); setShowValues(false) }
          }}
          className="bg-ds-bg border border-ds-border rounded px-1 py-0.5 w-24 text-xs font-mono outline-none text-ds-text"
          autoFocus
        />
      ) : (
        <span
          onClick={startEditing}
          className="font-mono cursor-pointer hover:underline"
        >
          {value || <span className="italic text-ds-textMuted">click to set</span>}
        </span>
      )}
      <button
        onClick={onRemove}
        className="ml-0.5 opacity-0 group-hover:opacity-100 hover:text-ds-red transition-all"
      >
        <X size={11} />
      </button>

      {/* Value suggestions dropdown */}
      {showValues && filteredValues.length > 0 && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-ds-surface border border-ds-border rounded shadow-lg max-h-[180px] min-w-[160px] max-w-[280px] overflow-y-auto">
          {filteredValues.map(v => (
            <button
              key={v}
              className="w-full text-left px-3 py-1 text-xs font-mono text-ds-text hover:bg-ds-accent/15 hover:text-ds-accent truncate"
              onMouseDown={(e) => { e.preventDefault(); commitValue(v) }}
            >
              {v}
            </button>
          ))}
          {uniqueValues.length > filteredValues.length && (
            <div className="px-3 py-1 text-[10px] text-ds-textMuted border-t border-ds-border">
              {uniqueValues.length - filteredValues.length} more values…
            </div>
          )}
        </div>
      )}
    </div>
  )
}
