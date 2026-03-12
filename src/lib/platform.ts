/** Detect if running on macOS */
export const isMac = () => {
  if (typeof navigator === 'undefined') return false
  return navigator.platform.toUpperCase().indexOf('MAC') >= 0
}

/** Get the modifier key symbol for the current platform */
export const getModifierSymbol = () => isMac() ? '⌘' : 'Ctrl'

/** Get the modifier key name for the current platform */
export const getModifierKey = () => isMac() ? 'Cmd' : 'Ctrl'
