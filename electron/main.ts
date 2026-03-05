import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import fs from 'fs'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0d1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

ipcMain.handle('open-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Spreadsheet Files', extensions: ['csv', 'json', 'tsv', 'xlsx', 'xls'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  const filePath = result.filePaths[0]
  const name = path.basename(filePath)
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.xlsx' || ext === '.xls') {
    // Binary file — return as base64
    const buffer = fs.readFileSync(filePath)
    return { filePath, content: buffer.toString('base64'), name, binary: true }
  }
  const content = fs.readFileSync(filePath, 'utf-8')
  return { filePath, content, name, binary: false }
})

ipcMain.handle('save-file', async (_event, data: { content: string; filePath?: string; binary?: boolean; suggestedName?: string }) => {
  let targetPath = data.filePath
  if (!targetPath) {
    const result = await dialog.showSaveDialog({
      defaultPath: data.suggestedName,
      filters: [
        { name: 'CSV', extensions: ['csv'] },
        { name: 'JSON', extensions: ['json'] },
        { name: 'Excel', extensions: ['xlsx'] },
        { name: 'TSV', extensions: ['tsv'] },
      ],
    })
    if (result.canceled || !result.filePath) return null
    targetPath = result.filePath
  }
  if (data.binary) {
    fs.writeFileSync(targetPath, Buffer.from(data.content, 'base64'))
  } else {
    fs.writeFileSync(targetPath, data.content, 'utf-8')
  }
  return targetPath
})
