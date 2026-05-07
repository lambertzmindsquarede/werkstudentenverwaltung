'use client'

import { createContext, useContext } from 'react'

interface ManagerNavContextValue {
  showAbwesenheiten: boolean
}

const ManagerNavContext = createContext<ManagerNavContextValue>({ showAbwesenheiten: true })

export function ManagerNavProvider({
  showAbwesenheiten,
  children,
}: {
  showAbwesenheiten: boolean
  children: React.ReactNode
}) {
  return (
    <ManagerNavContext.Provider value={{ showAbwesenheiten }}>
      {children}
    </ManagerNavContext.Provider>
  )
}

export function useManagerNav(): ManagerNavContextValue {
  return useContext(ManagerNavContext)
}
