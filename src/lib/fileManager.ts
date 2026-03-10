import { useStore } from '../store'
import { parseCSV, parseJSON, parseXLSX, rowsToCSV, rowsToJSON, rowsToXLSX, toLetterColumns } from './utils'
import { Column, Row } from '../types'

// Electron IPC bridge type
declare global {
  interface Window {
    devsheets?: {
      openFile: () => Promise<{ filePath: string; content: string; name: string; binary: boolean } | null>
      saveFile: (data: { content: string; filePath?: string; binary?: boolean; suggestedName?: string }) => Promise<string | null>
    }
  }
}

export const isElectron = () => !!window.devsheets

// Store file paths per sheet so subsequent saves write to the same file
export const filePaths = new Map<string, string>()

/**
 * Import a file using Electron IPC (native dialog + fs) when available,
 * returns false if not in Electron (caller should fallback to <input>).
 */
export async function electronImport(store: ReturnType<typeof useStore.getState>): Promise<boolean> {
  if (!isElectron()) return false

  try {
    const result = await window.devsheets!.openFile()
    if (!result) return true // user cancelled, but we handled it
    const { filePath, content, name: fileName, binary } = result
    const name = fileName.replace(/\.\w+$/, '')

    if (fileName.match(/\.xlsx?$/i)) {
      const raw = atob(content)
      const buffer = new Uint8Array(raw.length)
      for (let i = 0; i < raw.length; i++) buffer[i] = raw.charCodeAt(i)
      const sheets = parseXLSX(buffer.buffer)
      sheets.forEach((s, i) => {
        if (s.columns.length > 0) {
          const converted = toLetterColumns(s)
          store.loadData(converted.columns, converted.rows, sheets.length > 1 ? `${name} - Sheet ${i + 1}` : name)
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
      const converted = toLetterColumns(data)
      store.loadData(converted.columns, converted.rows, name)
      const newId = useStore.getState().activeSheetId
      filePaths.set(newId, filePath)
    }
  } catch (err: any) {
    console.error('Import failed:', err)
  }
  return true
}

/**
 * Get content string + binary flag for a given format, ready for Electron IPC save.
 */
export function getContentForSave(
  rows: Row[], columns: Column[], sheetName: string, format: 'csv' | 'json' | 'xlsx'
): { content: string; binary: boolean } {
  if (format === 'csv') {
    return { content: rowsToCSV(rows, columns), binary: false }
  } else if (format === 'json') {
    return { content: rowsToJSON(rows, columns), binary: false }
  } else {
    const buffer = rowsToXLSX(rows, columns, sheetName)
    const bytes = new Uint8Array(buffer)
    let binaryStr = ''
    for (let i = 0; i < bytes.length; i++) binaryStr += String.fromCharCode(bytes[i])
    return { content: btoa(binaryStr), binary: true }
  }
}

/**
 * Quick save to the stored file path (in-place). Returns true if saved, false if no path stored.
 */
export async function quickSaveToFile(
  rows: Row[], columns: Column[], sheetName: string
): Promise<boolean> {
  const sheetId = useStore.getState().activeSheetId
  const fp = filePaths.get(sheetId)
  if (!fp || !isElectron()) return false

  const ext = fp.toLowerCase()
  const format: 'csv' | 'json' | 'xlsx' = ext.endsWith('.json') ? 'json'
    : ext.endsWith('.xlsx') || ext.endsWith('.xls') ? 'xlsx' : 'csv'
  const { content, binary } = getContentForSave(rows, columns, sheetName, format)
  try {
    await window.devsheets!.saveFile({ content, binary, filePath: fp })
    return true
  } catch {
    return false
  }
}

/**
 * Save As with Electron IPC. Returns the saved path or null.
 */
export async function electronSaveAs(
  rows: Row[], columns: Column[], sheetName: string, format: 'csv' | 'json' | 'xlsx'
): Promise<string | null> {
  if (!isElectron()) return null
  const ext = format === 'csv' ? '.csv' : format === 'json' ? '.json' : '.xlsx'
  const { content, binary } = getContentForSave(rows, columns, sheetName, format)
  const savedPath = await window.devsheets!.saveFile({
    content,
    binary,
    suggestedName: `${sheetName}${ext}`,
  })
  if (savedPath) {
    filePaths.set(useStore.getState().activeSheetId, savedPath)
  }
  return savedPath
}
