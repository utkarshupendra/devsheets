import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('devsheets', {
  openFile: () => ipcRenderer.invoke('open-file'),
  saveFile: (data: { content: string; filePath?: string; binary?: boolean; suggestedName?: string }) =>
    ipcRenderer.invoke('save-file', data),
})
