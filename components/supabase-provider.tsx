// components/supabase-provider.tsx
'use client'

import { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'

type SupabaseContext = {
  supabase: SupabaseClient
  user: User | null // Mantenemos el user inicial para SSR
  // Eliminamos userDetails y loading de aquí, se manejarán localmente si es necesario
}

const Context = createContext<SupabaseContext | undefined>(undefined)

// Creamos el cliente Supabase una sola vez
const supabaseClientSingleton = createClient()

export function SupabaseProvider({ 
  children,
  initialUser
}: { 
  children: React.ReactNode
  initialUser: User | null
}) {
  // Proveemos la instancia singleton y el usuario inicial
  const value = {
    supabase: supabaseClientSingleton,
    user: initialUser,
  }

  // Eliminamos el useEffect que escuchaba onAuthStateChange
  // La lógica de escuchar cambios de auth se moverá a los hooks/componentes que la necesiten

  return (
    <Context.Provider value={value}>
      {children}
    </Context.Provider>
  )
}

// El hook solo devuelve el cliente y el usuario inicial
export function useSupabase() {
  const context = useContext(Context)
  if (context === undefined) {
    throw new Error('useSupabase debe usarse dentro de un SupabaseProvider')
  }
  return context
}