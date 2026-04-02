'use client'

import { useLayoutMode, type LayoutMode } from '../../hooks/useLayoutMode'
import { createContext, useContext } from 'react'

const LayoutModeContext = createContext<LayoutMode>('platform')

export function useLayoutModeContext(): LayoutMode {
  return useContext(LayoutModeContext)
}

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const mode = useLayoutMode()

  return (
    <LayoutModeContext.Provider value={mode}>
      <div data-layout-mode={mode}>
        {children}
      </div>
    </LayoutModeContext.Provider>
  )
}
