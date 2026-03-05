import React, { useState } from 'react'
import { useStore } from '../store'
import { Plus, X } from 'lucide-react'

export function SheetTabs() {
  const store = useStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const handleDoubleClick = (id: string, name: string) => {
    setEditingId(id)
    setEditName(name)
  }

  const commitRename = () => {
    if (editingId && editName.trim()) {
      store.renameSheet(editingId, editName.trim())
    }
    setEditingId(null)
  }

  return (
    <div className="flex items-center gap-0.5 px-2 py-1 bg-ds-surface border-t border-ds-border shrink-0 overflow-x-auto">
      {store.sheets.map(sheet => (
        <div
          key={sheet.id}
          onClick={() => store.setActiveSheet(sheet.id)}
          onDoubleClick={() => handleDoubleClick(sheet.id, sheet.name)}
          className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs cursor-pointer transition-colors group
            ${sheet.id === store.activeSheetId
              ? 'bg-ds-accent/15 text-ds-accent border border-ds-accent/30'
              : 'text-ds-textMuted hover:text-ds-text hover:bg-ds-surface2 border border-transparent'
            }`}
        >
          {editingId === sheet.id ? (
            <input
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingId(null) }}
              className="bg-ds-bg border border-ds-accent rounded px-1 py-0 text-xs font-mono outline-none text-ds-text w-24"
              autoFocus
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <>
              <span className="font-mono truncate max-w-[120px]">{sheet.name}</span>
              {store.sheets.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    store.removeSheet(sheet.id)
                  }}
                  className="opacity-0 group-hover:opacity-100 text-ds-textMuted hover:text-ds-red transition-all"
                >
                  <X size={10} />
                </button>
              )}
            </>
          )}
        </div>
      ))}
      <button
        onClick={() => store.addSheet(`Sheet ${store.sheets.length + 1}`, [], [])}
        className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-ds-textMuted hover:text-ds-text hover:bg-ds-surface2 transition-colors"
      >
        <Plus size={10} />
      </button>
    </div>
  )
}
