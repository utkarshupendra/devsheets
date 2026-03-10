import React, { useRef } from 'react'
import { useStore } from '../store'
import { parseCSV, parseJSON, parseXLSX, generateSampleData, generateId, createBlankGrid, toLetterColumns } from '../lib/utils'
import { electronImport } from '../lib/fileManager'
import { Upload, Plus, Database, Sun, Moon } from 'lucide-react'
import { Logo } from './Logo'
import { Column, Row } from '../types'

export function WelcomePage() {
  const store = useStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImportClick = async () => {
    const handled = await electronImport(store)
    if (!handled) fileInputRef.current?.click()
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
          sheets.forEach((sheet, i) => {
            if (sheet.columns.length > 0) {
              const converted = toLetterColumns(sheet)
              store.loadData(converted.columns, converted.rows, sheets.length > 1 ? `${name} - Sheet ${i + 1}` : name)
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
          const converted = toLetterColumns(data)
          store.loadData(converted.columns, converted.rows, name)
        } catch (err) {
          console.error('Failed to parse file:', err)
        }
      }
      reader.readAsText(file)
    }
    e.target.value = ''
  }

  const handleNewSheet = () => {
    const { columns, rows } = createBlankGrid(26, 100)
    store.loadData(columns, rows, 'Untitled')
  }

  const handleLoadSample = () => {
    const data = generateSampleData()
    const converted = toLetterColumns(data)
    store.loadData(converted.columns, converted.rows, 'Sample — GitHub Repos')
  }

  return (
    <div className="h-screen flex flex-col bg-ds-bg text-ds-text">
      {/* Title bar */}
      <div className="drag-region h-8 flex items-center pl-[80px] pr-4 bg-ds-surface border-b border-ds-border shrink-0">
        <div className="no-drag flex items-center gap-2">
          <Logo size={20} />
          <span className="text-xs font-bold text-ds-text">Dev<span className="text-ds-accent">Sheets</span></span>
        </div>
        <div className="flex-1" />
        <button
          onClick={() => store.toggleTheme()}
          className="no-drag text-ds-textMuted hover:text-ds-text p-1 rounded hover:bg-ds-surface2"
        >
          {store.theme === 'dark' ? <Sun size={12} /> : <Moon size={12} />}
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center">
        <div className="max-w-lg w-full px-8">
          <div className="mb-10">
            <div className="flex items-center gap-4 mb-2">
              <Logo size={52} />
              <div>
                <h1 className="text-2xl font-bold text-ds-text">Dev<span className="text-ds-accent">Sheets</span></h1>
              </div>
            </div>
            <p className="text-sm text-ds-textMuted leading-relaxed">
              A developer-friendly spreadsheet. Transparent sorts, composable filters, programmable pivots.
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleImportClick}
              className="w-full flex items-center gap-4 p-4 rounded-lg border border-ds-border bg-ds-surface hover:bg-ds-surface2 hover:border-ds-accent/40 transition-colors group text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-ds-accent/10 flex items-center justify-center group-hover:bg-ds-accent/20">
                <Upload size={18} className="text-ds-accent" />
              </div>
              <div>
                <div className="text-sm font-medium text-ds-text">Open File</div>
                <div className="text-xs text-ds-textMuted mt-0.5">CSV, TSV, JSON, XLSX</div>
              </div>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv,.json,.xlsx,.xls"
              className="hidden"
              onChange={handleImport}
            />

            <button
              onClick={handleNewSheet}
              className="w-full flex items-center gap-4 p-4 rounded-lg border border-ds-border bg-ds-surface hover:bg-ds-surface2 hover:border-ds-accent/40 transition-colors group text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-ds-green/10 flex items-center justify-center group-hover:bg-ds-green/20">
                <Plus size={18} className="text-ds-green" />
              </div>
              <div>
                <div className="text-sm font-medium text-ds-text">New Blank Sheet</div>
                <div className="text-xs text-ds-textMuted mt-0.5">Start with an empty spreadsheet</div>
              </div>
            </button>

            <button
              onClick={handleLoadSample}
              className="w-full flex items-center gap-4 p-4 rounded-lg border border-ds-border bg-ds-surface hover:bg-ds-surface2 hover:border-ds-accent/40 transition-colors group text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-ds-purple/10 flex items-center justify-center group-hover:bg-ds-purple/20">
                <Database size={18} className="text-ds-purple" />
              </div>
              <div>
                <div className="text-sm font-medium text-ds-text">Load Sample Data</div>
                <div className="text-xs text-ds-textMuted mt-0.5">30 GitHub repos with stars, forks, and more</div>
              </div>
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-ds-border/50">
            <div className="flex items-center justify-between text-[10px] text-ds-textMuted">
              <span>⌘K for command palette</span>
              <span>Arrow keys to navigate • Enter to edit</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
