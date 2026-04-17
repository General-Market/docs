'use client'

import { createContext, useContext, type ReactNode } from 'react'

const Web3Context = createContext(false)

export function Web3Provider({ children }: { children: ReactNode }) {
  return <Web3Context.Provider value={true}>{children}</Web3Context.Provider>
}

export function useWeb3Available() {
  return useContext(Web3Context)
}
