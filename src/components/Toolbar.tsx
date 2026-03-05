import React, { useRef, useState, useEffect } from 'react'
import { useStore } from '../store'
import { parseCSV, parseJSON, parseXLSX, rowsToCSV, rowsToJSON, rowsToXLSX } from '../lib/utils'
import { Column, Row } from '../types'
import {
  ArrowUpDown, Filter, Table2, Columns3, Plus, Download, Upload,
  Layers, Command, RotateCcw, Save,
} from 'lucide-react'

// Electron IPC bridge type
declare global {
  interface Window {
    devsheets?: {
      openFile: () => Promise<{ filePath: string; content: string; name: string; binary: boolean } | null>
      saveFile: (data: { content: string; filePath?: string; binary?: boolean; suggestedName?: string }) => Promise<string | null>
    }
  }
}

const isElectron = () => !!window.devsheets

// Store file paths per sheet so subsequent saves go to the same file
const filePaths = new Map<string, string>()

export function Toolbar() {
  const store = useStore()
  const sheet = store.sheets.find(s => s.id === store.activeSheetId)!
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showSaveMenu, setShowSaveMenu] = useState(false)
  const saveMenuRef = useRef<HTMLDivElement>(null)

  // --- IMPORT ---
  const handleImportClick = async () => {
    if (isElectron()) {
      try {
        const result = await window.devsheets!.openFile()
        if (!result) return
        const { filePath, content, name: fileName, binary } = result
        const name = fileName.replace(/\.\w+$/, '')

        if (fileName.match(/\.xlsx?$/i)) {
          // Decode base64 to ArrayBuffer
          const raw = atob(content)
          const buffer = new Uint8Array(raw.length)
          for (let i = 0; i < raw.length; i++) buffer[i] = raw.charCodeAt(i)
          const sheets = parseXLSX(buffer.buffer)
          sheets.forEach((s, i) => {
            if (s.columns.length > 0) {
              store.loadData(s.columns, s.rows, sheets.length > 1 ? `${name} - Sheet ${i + 1}` : name)
              const newId = useStore.getState().activeSheetId
              if (i === 0 || sheets.length === 1) {
                filePaths.set(newId, filePath)
              }
            }
          })
        } else {
          let data: { columns: Column[]; rows: Row[] }
          if (fileName.endsWith('.json')) {
            data = parseJSON(content)
          } else {
            data = parseCSV(content)
          }
          store.loadData(data.columns, data.rows, name)
          const newId = useStore.getState().activeSheetId
          filePaths.set(newId, filePath)
        }
      } catch (err: any) {
        console.error('Import failed:', err)
      }
    } else {
      // Browser fallback: use file input
      fileInputRef.current?.click()
    }
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const name = file.name.replace(/\.\w+$/, '')

    if (file.name.match(/\.xlsx?$/i)) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        try {
          const buffer = ev.target?.result as ArrayBuffer
          const sheets = parseXLSX(buffer)
          sheets.forEach((s, i) => {
            if (s.columns.length > 0) {
              store.loadData(s.columns, s.rows, sheets.length > 1 ? `${name} - Sheet ${i + 1}` : name)
            }
          })
        } catch (err) {
          console.error('Failed to parse XLSX:', err)
        }
      }
      reader.readAsArrayBuffer(file)
    } else {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const text = ev.target?.result as string
        try {
          let data: { columns: Column[]; rows: Row[] }
          if (file.name.endsWith('.json')) {
            data = parseJSON(text)
          } else {
            data = parseCSV(text)
          }
          store.loadData(data.columns, data.rows, name)
        } catch (err) {
          console.error('Failed to parse file:', err)
        }
      }
      reader.readAsText(file)
    }
    e.target.value = ''
  }

  // --- SAVE helpers ---
  const getContentForSave = (format: 'csv' | 'json' | 'xlsx'): { content: string; binary: boolean } => {
    if (format === 'csv') {
      return { content: rowsToCSV(sheet.rows, sheet.columns), binary: false }
    } else if (format === 'json') {
      return { content: rowsToJSON(sheet.rows, sheet.columns), binary: false }
    } else {
      // XLSX → base64
      const buffer = rowsToXLSX(sheet.rows, sheet.columns, sheet.name)
      const bytes = new Uint8Array(buffer)
      let binaryStr = ''
      for (let i = 0; i < bytes.length; i++) binaryStr += String.fromCharCode(bytes[i])
      return { content: btoa(binaryStr), binary: true }
    }
  }

  const buildBlob = (format: 'csv' | 'json' | 'xlsx'): Blob => {
    if (format === 'csv') {
      return new Blob([rowsToCSV(sheet.rows, sheet.columns)], { type: 'text/csv' })
    } else if (format === 'json') {
      return new Blob([rowsToJSON(sheet.rows, sheet.columns)], { type: 'application/json' })
    } else {
      const buffer = rowsToXLSX(sheet.rows, sheet.columns, sheet.name)
      return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    }
  }

  const saveAs = async (format: 'csv' | 'json' | 'xlsx') => {
    setShowSaveMenu(false)
    const ext = format === 'csv' ? '.csv' : format === 'json' ? '.json' : '.xlsx'

    if (isElectron()) {
      const { content, binary } = getContentForSave(format)
      const savedPath = await window.devsheets!.saveFile({
        content,
        binary,
        suggestedName: `${sheet.name}${ext}`,
      })
      if (savedPath) {
        filePaths.set(useStore.getState().activeSheetId, savedPath)
      }
    } else {
      // Browser fallback: download
      const blob = buildBlob(format)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${sheet.name}${ext}`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  // Quick save: writes to existing path, or shows Save As menu
  const quickSave = async () => {
    const sheetId = useStore.getState().activeSheetId
    const fp = filePaths.get(sheetId)
    if (fp && isElectron()) {
      const ext = fp.toLowerCase()
      const format: 'csv' | 'json' | 'xlsx' = ext.endsWith('.json') ? 'json' : ext.endsWith('.xlsx') || ext.endsWith('.xls') ? 'xlsx' : 'csv'
      const { content, binary } = getContentForSave(format)
      try {
        await window.devsheets!.saveFile({ content, binary, filePath: fp })
      } catch {
        setShowSaveMenu(true)
      }
    } else {
      setShowSaveMenu(true)
    }
  }

  // Close save menu on outside click
  useEffect(() => {
    if (!showSaveMenu) return
    const handleClick = (e: MouseEvent) => {
      if (saveMenuRef.current && !saveMenuRef.current.contains(e.target as Node)) {
        setShowSaveMenu(false)
      }
    }
    window.addEventListener('mousedown', handleClick)
    return () => window.removeEventListener('mousedown', handleClick)
  }, [showSaveMenu])

  // Cmd+S / Ctrl+S → quick save (in-place if path exists, otherwise show menu)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        quickSave()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [store.activeSheetId, sheet])

  return (
    <div className="flex items-center gap-1 px-3 py-1.5 bg-ds-surface border-b border-ds-border shrink-0">
      <ToolButton
        icon={<Upload size={14} />}
        label="Import"
        onClick={handleImportClick}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.tsv,.json,.xlsx,.xls"
        className="hidden"
        onChange={handleImport}
      />

      {/* Save / Export with format picker */}
      <div ref={saveMenuRef} className="relative">
        <ToolButton icon={<Save size={14} />} label="Save" onClick={() => setShowSaveMenu(s => !s)} />
        {showSaveMenu && (
          <div className="absolute left-0 top-full mt-1 z-50 bg-ds-surface border border-ds-border rounded-lg shadow-xl py-1 min-w-[180px] animate-fade-in">
            <button
              onClick={() => saveAs('csv')}
              className="w-full flex items-center justify-between px-3 py-2 text-xs text-ds-text hover:bg-ds-surface2"
            >
              <span>Save as CSV</span>
              <span className="text-ds-textMuted text-[10px] font-mono">.csv</span>
            </button>
            <button
              onClick={() => saveAs('json')}
              className="w-full flex items-center justify-between px-3 py-2 text-xs text-ds-text hover:bg-ds-surface2"
            >
              <span>Save as JSON</span>
              <span className="text-ds-textMuted text-[10px] font-mono">.json</span>
            </button>
            <button
              onClick={() => saveAs('xlsx')}
              className="w-full flex items-center justify-between px-3 py-2 text-xs text-ds-text hover:bg-ds-surface2"
            >
              <span>Save as Excel</span>
              <span className="text-ds-textMuted text-[10px] font-mono">.xlsx</span>
            </button>
          </div>
        )}
      </div>

      <div className="w-px h-5 bg-ds-border mx-1" />

      <ToolButton
        icon={<ArrowUpDown size={14} />}
        label="Sort"
        active={sheet.sortRules.length > 0}
        onClick={() => {
          if (sheet.columns.length > 0) {
            const firstCol = sheet.columns[0]
            store.addSortRule(firstCol.id, 'asc')
          }
        }}
      />
      <ToolButton
        icon={<Filter size={14} />}
        label="Filter"
        active={sheet.filterRules.some(f => f.enabled)}
        onClick={() => {
          if (sheet.columns.length > 0) {
            store.addFilterRule(sheet.columns[0].id, 'contains', '')
          }
        }}
      />
      <ToolButton
        icon={<Table2 size={14} />}
        label="Pivot"
        active={sheet.pivotConfig !== null}
        onClick={() => {
          if (sheet.pivotConfig) {
            store.setPivotConfig(null)
          } else {
            store.setPivotConfig({
              rowFields: [],
              colFields: [],
              valueFields: [],
              enabled: true,
            })
          }
        }}
      />

      <div className="w-px h-5 bg-ds-border mx-1" />

      <ToolButton
        icon={<Layers size={14} />}
        label="Pipeline"
        active={store.showPipeline}
        onClick={() => store.togglePipeline()}
      />

      <ToolButton
        icon={<Plus size={14} />}
        label="Add Col"
        onClick={() => store.addColumn(`col_${sheet.columns.length + 1}`, 'string')}
      />
      <ToolButton
        icon={<Columns3 size={14} />}
        label="Add Row"
        onClick={() => store.addRow()}
      />

      <div className="flex-1" />

      {(sheet.sortRules.length > 0 || sheet.filterRules.length > 0) && (
        <ToolButton
          icon={<RotateCcw size={14} />}
          label="Reset"
          onClick={() => {
            store.clearSortRules()
            store.clearFilterRules()
            store.setPivotConfig(null)
          }}
        />
      )}

      <ToolButton
        icon={<Command size={14} />}
        label="⌘K"
        onClick={() => store.toggleCommandPalette()}
      />
    </div>
  )
}

function ToolButton({
  icon, label, onClick, active = false,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors
        ${active
          ? 'bg-ds-accent/15 text-ds-accent border border-ds-accent/30'
          : 'text-ds-textMuted hover:text-ds-text hover:bg-ds-surface2 border border-transparent'
        }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}
