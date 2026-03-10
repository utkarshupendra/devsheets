import React, { useState, useCallback, useRef, useEffect, memo } from 'react'
import { useStore } from '../store'
import { Column, Row, CellValue } from '../types'
import { colIndexToLetter, generateId, createBlankGrid } from '../lib/utils'
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'

interface GridProps {
  columns: Column[]
  rows: Row[]
  selectedCell: { row: number; col: number } | null
  isPivot: boolean
}

const ROW_HEIGHT = 32
const HEADER_HEIGHT = 36
const VISIBLE_BUFFER = 5

export function Grid({ columns, rows, selectedCell, isPivot }: GridProps) {
  const store = useStore()
  const sheet = store.sheets.find(s => s.id === store.activeSheetId)!
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(600)
  const [editingCell, setEditingCell] = useState<{ rowId: string; colId: string } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; colId?: string; rowId?: string; rowIndex?: number } | null>(null)
  const [resizing, setResizing] = useState<{ colId: string; startX: number; startWidth: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const isDraggingRef = useRef(false)
  const dragAnchor = useRef<{ row: number; col: number } | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height)
      }
    })
    ro.observe(el)
    setContainerHeight(el.clientHeight)
    return () => ro.disconnect()
  }, [])

  // Column resize drag handler
  useEffect(() => {
    if (!resizing) return
    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - resizing.startX
      store.resizeColumn(resizing.colId, resizing.startWidth + delta)
    }
    const handleMouseUp = () => setResizing(null)
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [resizing, store])

  const totalHeight = rows.length * ROW_HEIGHT
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - VISIBLE_BUFFER)
  const endIndex = Math.min(rows.length, Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + VISIBLE_BUFFER)
  const visibleRows = rows.slice(startIndex, endIndex)
  const totalWidth = columns.reduce((sum, col) => sum + col.width, 0)

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  const selectionRange = sheet.selectionRange

  const handleCellMouseDown = useCallback((actualIndex: number, colIndex: number, e: React.MouseEvent) => {
    if (e.button !== 0) return // left click only
    if (e.shiftKey && selectedCell) {
      store.setSelectionRange({
        startRow: selectedCell.row,
        startCol: selectedCell.col,
        endRow: actualIndex,
        endCol: colIndex,
      })
    } else {
      store.selectCell(actualIndex, colIndex)
      dragAnchor.current = { row: actualIndex, col: colIndex }
      isDraggingRef.current = true
      setIsDragging(true)
    }
  }, [store, selectedCell])

  const handleCellMouseEnter = useCallback((actualIndex: number, colIndex: number) => {
    if (!isDraggingRef.current || !dragAnchor.current) return
    store.setSelectionRange({
      startRow: dragAnchor.current.row,
      startCol: dragAnchor.current.col,
      endRow: actualIndex,
      endCol: colIndex,
    })
  }, [store])

  // Global mouseup to end drag
  useEffect(() => {
    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false
        setIsDragging(false)
        dragAnchor.current = null
      }
    }
    window.addEventListener('mouseup', handleMouseUp)
    return () => window.removeEventListener('mouseup', handleMouseUp)
  }, [])

  const handleCellDoubleClick = useCallback((rowId: string, colId: string, value: CellValue) => {
    if (isPivot) return
    setEditingCell({ rowId, colId })
    setEditValue(value === null ? '' : String(value))
  }, [isPivot])

  const commitEdit = useCallback(() => {
    if (editingCell) {
      const col = columns.find(c => c.id === editingCell.colId)
      let finalValue: CellValue = editValue
      if (col?.type === 'number') {
        const num = Number(editValue)
        finalValue = isNaN(num) ? editValue : num
      } else if (col?.type === 'boolean') {
        finalValue = editValue === 'true'
      }
      store.setCell(editingCell.rowId, editingCell.colId, finalValue)
      setEditingCell(null)
    }
  }, [editingCell, editValue, columns, store])

  const handleHeaderClick = useCallback((colId: string) => {
    if (resizing) return
    const existing = sheet.sortRules.find(r => r.columnId === colId)
    if (existing) {
      if (existing.direction === 'asc') {
        store.addSortRule(colId, 'desc')
      } else {
        store.removeSortRule(colId)
      }
    } else {
      store.addSortRule(colId, 'asc')
    }
  }, [sheet.sortRules, store, resizing])

  const handleHeaderContext = useCallback((e: React.MouseEvent, colId: string) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, colId })
  }, [])

  const handleRowContext = useCallback((e: React.MouseEvent, rowId: string, rowIndex: number) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, rowId, rowIndex })
  }, [])

  const handleResizeStart = useCallback((e: React.MouseEvent, colId: string, currentWidth: number) => {
    e.stopPropagation()
    e.preventDefault()
    setResizing({ colId, startX: e.clientX, startWidth: currentWidth })
  }, [])

  useEffect(() => {
    const handleClick = () => setContextMenu(null)
    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!selectedCell || editingCell) return
    const { row, col } = selectedCell

    switch (e.key) {
      case 'ArrowUp': {
        e.preventDefault()
        if (e.shiftKey) {
          const sr = selectionRange ?? { startRow: row, startCol: col, endRow: row, endCol: col }
          const endRow = Math.max(0, sr.endRow - 1)
          store.setSelectionRange({ ...sr, endRow })
        } else {
          store.selectCell(Math.max(0, row - 1), col)
        }
        break
      }
      case 'ArrowDown': {
        e.preventDefault()
        if (e.shiftKey) {
          const sr = selectionRange ?? { startRow: row, startCol: col, endRow: row, endCol: col }
          const endRow = sr.endRow + 1
          if (endRow >= rows.length) store.ensureRows(endRow + 1)
          store.setSelectionRange({ ...sr, endRow })
        } else {
          const nextRow = row + 1
          if (nextRow >= rows.length) store.ensureRows(nextRow + 1)
          store.selectCell(nextRow, col)
        }
        break
      }
      case 'ArrowLeft': {
        e.preventDefault()
        if (e.shiftKey) {
          const sr = selectionRange ?? { startRow: row, startCol: col, endRow: row, endCol: col }
          const endCol = Math.max(0, sr.endCol - 1)
          store.setSelectionRange({ ...sr, endCol })
        } else {
          store.selectCell(row, Math.max(0, col - 1))
        }
        break
      }
      case 'ArrowRight': {
        e.preventDefault()
        if (e.shiftKey) {
          const sr = selectionRange ?? { startRow: row, startCol: col, endRow: row, endCol: col }
          const endCol = sr.endCol + 1
          if (endCol >= columns.length) store.ensureColumns(endCol + 1)
          store.setSelectionRange({ ...sr, endCol })
        } else {
          const nextCol = col + 1
          if (nextCol >= columns.length) store.ensureColumns(nextCol + 1)
          store.selectCell(row, nextCol)
        }
        break
      }
      case 'Tab': {
        e.preventDefault()
        if (e.shiftKey) {
          if (col > 0) store.selectCell(row, col - 1)
        } else {
          const nextCol = col + 1
          if (nextCol >= columns.length) store.ensureColumns(nextCol + 1)
          store.selectCell(row, nextCol)
        }
        break
      }
      case 'Enter': {
        e.preventDefault()
        if (editingCell) break
        const r = rows[row]
        const c = columns[col]
        if (r && c && !isPivot) {
          handleCellDoubleClick(r.id, c.id, r.cells[c.id])
        }
        break
      }
      case 'Delete':
      case 'Backspace':
        if (!isPivot) {
          const sr = selectionRange ?? { startRow: row, startCol: col, endRow: row, endCol: col }
          const minR = Math.min(sr.startRow, sr.endRow)
          const maxR = Math.max(sr.startRow, sr.endRow)
          const minC = Math.min(sr.startCol, sr.endCol)
          const maxC = Math.max(sr.startCol, sr.endCol)
          const batch: { rowId: string; colId: string; value: CellValue }[] = []
          for (let ri = minR; ri <= maxR; ri++) {
            for (let ci2 = minC; ci2 <= maxC; ci2++) {
              const r2 = rows[ri]
              const c2 = columns[ci2]
              if (r2 && c2) batch.push({ rowId: r2.id, colId: c2.id, value: null })
            }
          }
          if (batch.length === 1) {
            store.setCell(batch[0].rowId, batch[0].colId, null)
          } else if (batch.length > 1) {
            store.setCellBatch(batch)
          }
        }
        break
      default:
        // Copy (Cmd+C / Ctrl+C)
        if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
          e.preventDefault()
          const sr = selectionRange ?? { startRow: row, startCol: col, endRow: row, endCol: col }
          const minR = Math.min(sr.startRow, sr.endRow)
          const maxR = Math.max(sr.startRow, sr.endRow)
          const minC = Math.min(sr.startCol, sr.endCol)
          const maxC = Math.max(sr.startCol, sr.endCol)
          const lines: string[] = []
          for (let ri = minR; ri <= maxR; ri++) {
            const cells: string[] = []
            for (let ci2 = minC; ci2 <= maxC; ci2++) {
              const r2 = rows[ri]
              const c2 = columns[ci2]
              const val = r2?.cells[c2?.id] ?? ''
              cells.push(val === null ? '' : String(val))
            }
            lines.push(cells.join('\t'))
          }
          navigator.clipboard.writeText(lines.join('\n'))
        }
        // Paste (Cmd+V / Ctrl+V)
        if ((e.metaKey || e.ctrlKey) && e.key === 'v' && !isPivot) {
          e.preventDefault()
          navigator.clipboard.readText().then(text => {
            if (!text.trim()) return
            const pasteRows = text.split('\n').map(line => line.split('\t'))
            const batch: { rowId: string; colId: string; value: CellValue }[] = []
            for (let ri = 0; ri < pasteRows.length; ri++) {
              const targetRow = rows[row + ri]
              if (!targetRow) break
              for (let ci2 = 0; ci2 < pasteRows[ri].length; ci2++) {
                const targetCol = columns[col + ci2]
                if (!targetCol) break
                let val: string | number = pasteRows[ri][ci2]
                if (targetCol.type === 'number' && val !== '' && !isNaN(Number(val))) {
                  batch.push({ rowId: targetRow.id, colId: targetCol.id, value: Number(val) })
                } else {
                  batch.push({ rowId: targetRow.id, colId: targetCol.id, value: val })
                }
              }
            }
            if (batch.length > 0) store.setCellBatch(batch)
            // Select the pasted range
            const endRow = Math.min(rows.length - 1, row + pasteRows.length - 1)
            const endCol = Math.min(columns.length - 1, col + (pasteRows[0]?.length ?? 1) - 1)
            store.setSelectionRange({ startRow: row, startCol: col, endRow, endCol })
          })
        }
        // Start editing on printable key press (like Excel)
        if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key.length === 1 && !isPivot) {
          const r = rows[row]
          const c = columns[col]
          if (r && c) {
            setEditingCell({ rowId: r.id, colId: c.id })
            setEditValue(e.key)
          }
        }
        break
    }
  }, [selectedCell, editingCell, rows, columns, isPivot, store, handleCellDoubleClick, selectionRange])

  // Auto-scroll when navigating with keyboard
  useEffect(() => {
    if (!selectedCell || !containerRef.current) return
    const el = containerRef.current
    const rowTop = selectedCell.row * ROW_HEIGHT
    const rowBottom = rowTop + ROW_HEIGHT
    const viewTop = el.scrollTop + HEADER_HEIGHT
    const viewBottom = el.scrollTop + el.clientHeight

    if (rowTop < viewTop) {
      el.scrollTop = rowTop - HEADER_HEIGHT
    } else if (rowBottom > viewBottom) {
      el.scrollTop = rowBottom - el.clientHeight + HEADER_HEIGHT
    }
  }, [selectedCell])

  if (columns.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-ds-bg">
        <div className="text-center space-y-3">
          <div className="text-4xl opacity-20">📊</div>
          <p className="text-sm text-ds-textMuted">No data loaded</p>
          <p className="text-xs text-ds-textMuted/60">Import a CSV/JSON/XLSX file or add columns to get started</p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="h-full overflow-auto outline-none focus:outline-none"
      onScroll={handleScroll}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      style={{ cursor: resizing ? 'col-resize' : undefined, userSelect: isDragging ? 'none' : undefined }}
    >
      <div style={{ minWidth: totalWidth + 50 }}>
        {/* Header */}
        <div
          className="sticky top-0 z-10 flex bg-ds-surface2 border-b border-ds-border"
          style={{ height: HEADER_HEIGHT }}
        >
          <div
            className="w-[50px] shrink-0 flex items-center justify-center text-[10px] text-ds-textMuted border-r border-ds-border bg-ds-surface2 sticky left-0 z-20 cursor-pointer hover:bg-ds-accent/20"
            onClick={() => store.selectAll(rows.length, columns.length)}
            title="Select all"
          >
            #
          </div>
          {columns.map((col, ci) => {
            const sortRule = sheet.sortRules.find(r => r.columnId === col.id)
            const letter = colIndexToLetter(ci)
            const hasCustomName = col.name !== letter
            return (
              <div
                key={col.id}
                className="relative flex items-center gap-1.5 px-3 border-r border-ds-border cursor-pointer hover:bg-ds-surface select-none group"
                style={{ width: col.width, height: HEADER_HEIGHT }}
                onClick={() => store.selectEntireColumn(ci, rows.length)}
                onContextMenu={(e) => handleHeaderContext(e, col.id)}
              >
                <div className="flex flex-col min-w-0 flex-1">
                  {hasCustomName ? (
                    <>
                      <span className="text-[9px] text-ds-textMuted font-mono leading-none">{letter}</span>
                      <span className="text-xs font-semibold text-ds-text font-mono truncate leading-tight">{col.name}</span>
                    </>
                  ) : (
                    <span className="text-xs font-semibold text-ds-text font-mono truncate">{letter}</span>
                  )}
                </div>
                <div className="ml-auto flex items-center shrink-0">
                  {sortRule ? (
                    sortRule.direction === 'asc'
                      ? <ArrowUp size={12} className="text-ds-accent" />
                      : <ArrowDown size={12} className="text-ds-accent" />
                  ) : (
                    <ArrowUpDown size={11} className="text-ds-textMuted/30 group-hover:text-ds-textMuted" />
                  )}
                </div>
                {/* Resize handle */}
                <div
                  className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize hover:bg-ds-accent/40 z-30"
                  onMouseDown={(e) => handleResizeStart(e, col.id, col.width)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )
          })}
        </div>

        {/* Virtualized Rows */}
        <div style={{ height: totalHeight, position: 'relative' }}>
          {visibleRows.map((row, vi) => {
            const actualIndex = startIndex + vi
            return (
              <div
                key={row.id}
                className={`flex absolute w-full border-b border-ds-border/50
                  ${actualIndex % 2 === 0 ? 'bg-ds-bg' : 'bg-ds-surface/30'}`}
                style={{ top: actualIndex * ROW_HEIGHT, height: ROW_HEIGHT }}
              >
                <div
                  className="w-[50px] shrink-0 flex items-center justify-center text-[10px] text-ds-textMuted border-r border-ds-border/50 font-mono sticky left-0 bg-inherit z-10 cursor-pointer hover:bg-ds-accent/20"
                  onClick={() => store.selectEntireRow(actualIndex, columns.length)}
                  onContextMenu={(e) => handleRowContext(e, row.id, actualIndex)}
                >
                  {actualIndex + 1}
                </div>
                {columns.map((col, ci) => {
                  const isSelected = selectedCell?.row === actualIndex && selectedCell?.col === ci
                  const isEditing = editingCell?.rowId === row.id && editingCell?.colId === col.id
                  const value = row.cells[col.id]
                  // Check if cell is in selection range
                  let inRange = false
                  if (selectionRange) {
                    const minR = Math.min(selectionRange.startRow, selectionRange.endRow)
                    const maxR = Math.max(selectionRange.startRow, selectionRange.endRow)
                    const minC = Math.min(selectionRange.startCol, selectionRange.endCol)
                    const maxC = Math.max(selectionRange.startCol, selectionRange.endCol)
                    inRange = actualIndex >= minR && actualIndex <= maxR && ci >= minC && ci <= maxC
                  }

                  return (
                    <div
                      key={col.id}
                      className={`flex items-center px-3 border-r border-ds-border/30 cursor-default
                        ${isSelected ? 'ring-2 ring-ds-accent ring-inset bg-ds-accent/5' : ''}
                        ${inRange && !isSelected ? 'bg-ds-accent/10' : ''}
                        ${col.type === 'number' ? 'justify-end' : ''}`}
                      style={{ width: col.width, height: ROW_HEIGHT }}
                      onMouseDown={(e) => handleCellMouseDown(actualIndex, ci, e)}
                      onMouseEnter={() => handleCellMouseEnter(actualIndex, ci)}
                      onDoubleClick={() => handleCellDoubleClick(row.id, col.id, value)}
                    >
                      {isEditing ? (
                        <input
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={commitEdit}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              commitEdit()
                              // Move down after Enter
                              const nextRow = actualIndex + 1
                              if (nextRow >= rows.length) store.ensureRows(nextRow + 1)
                              store.selectCell(nextRow, ci)
                            }
                            if (e.key === 'Tab') {
                              e.preventDefault()
                              commitEdit()
                              // Move right (or left with shift) after Tab
                              if (e.shiftKey) {
                                if (ci > 0) store.selectCell(actualIndex, ci - 1)
                              } else {
                                const nextCol = ci + 1
                                if (nextCol >= columns.length) store.ensureColumns(nextCol + 1)
                                store.selectCell(actualIndex, nextCol)
                              }
                            }
                            if (e.key === 'Escape') setEditingCell(null)
                          }}
                          className="w-full bg-ds-bg border border-ds-accent rounded px-1 py-0.5 text-xs font-mono text-ds-text outline-none"
                          autoFocus
                        />
                      ) : (
                        <span className={`text-xs font-mono truncate ${
                          value === null || value === '' ? '' :
                          col.type === 'number' ? 'text-ds-orange' :
                          col.type === 'boolean' ? 'text-ds-purple' :
                          'text-ds-text'
                        }`}>
                          {value === null ? '' : String(value)}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-ds-surface border border-ds-border rounded-lg shadow-xl py-1 min-w-[180px] animate-fade-in"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.colId ? (
            <>
              <CtxItem
                label="Sort ascending"
                shortcut="↑"
                onClick={() => { store.addSortRule(contextMenu.colId!, 'asc'); setContextMenu(null) }}
              />
              <CtxItem
                label="Sort descending"
                shortcut="↓"
                onClick={() => { store.addSortRule(contextMenu.colId!, 'desc'); setContextMenu(null) }}
              />
              <div className="h-px bg-ds-border my-1" />
              <CtxItem
                label="Filter this column"
                shortcut="F"
                onClick={() => { store.addFilterRule(contextMenu.colId!, 'contains', ''); setContextMenu(null) }}
              />
              <div className="h-px bg-ds-border my-1" />
              <CtxItem
                label="Delete column"
                shortcut="Del"
                danger
                onClick={() => { store.removeColumn(contextMenu.colId!); setContextMenu(null) }}
              />
            </>
          ) : (
            <>
              <CtxItem
                label={`Row ${(contextMenu.rowIndex ?? 0) + 1}`}
                shortcut=""
                onClick={() => {}}
              />
              <div className="h-px bg-ds-border my-1" />
              <CtxItem
                label="Insert row above"
                shortcut=""
                onClick={() => { store.insertRowAt(contextMenu.rowIndex!); setContextMenu(null) }}
              />
              <CtxItem
                label="Insert row below"
                shortcut=""
                onClick={() => { store.insertRowAt(contextMenu.rowIndex! + 1); setContextMenu(null) }}
              />
              <div className="h-px bg-ds-border my-1" />
              <CtxItem
                label="Delete row"
                shortcut="Del"
                danger
                onClick={() => { store.removeRow(contextMenu.rowId!); setContextMenu(null) }}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}

function CtxItem({ label, shortcut, onClick, danger = false }: {
  label: string; shortcut: string; onClick: () => void; danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3 py-1.5 text-xs hover:bg-ds-surface2
        ${danger ? 'text-ds-red hover:text-ds-red' : 'text-ds-text'}`}
    >
      <span>{label}</span>
      <span className="text-ds-textMuted text-[10px] font-mono">{shortcut}</span>
    </button>
  )
}
