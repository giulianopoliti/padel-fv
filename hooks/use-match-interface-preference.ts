"use client"

import { useState, useEffect } from "react"

export interface MatchInterfacePreferences {
  useUnifiedInterface: boolean
  useEnhancedCreation: boolean
}

const DEFAULT_PREFERENCES: MatchInterfacePreferences = {
  useUnifiedInterface: true,
  useEnhancedCreation: true
}

const STORAGE_KEY = "tournament_match_interface_preferences"

export function useMatchInterfacePreference() {
  const [preferences, setPreferences] = useState<MatchInterfacePreferences>(DEFAULT_PREFERENCES)
  const [isLoaded, setIsLoaded] = useState(false)

  // Cargar preferencias del localStorage al montar el componente
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored)
          setPreferences({
            ...DEFAULT_PREFERENCES,
            ...parsed
          })
        }
      } catch (error) {
        console.warn("Error loading match interface preferences:", error)
      } finally {
        setIsLoaded(true)
      }
    } else {
      setIsLoaded(true)
    }
  }, [])

  // Guardar preferencias en localStorage cuando cambien
  const updatePreferences = (newPreferences: Partial<MatchInterfacePreferences>) => {
    const updated = { ...preferences, ...newPreferences }
    setPreferences(updated)
    
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      } catch (error) {
        console.warn("Error saving match interface preferences:", error)
      }
    }
  }

  // Función de utilidad para resetear a valores por defecto
  const resetPreferences = () => {
    setPreferences(DEFAULT_PREFERENCES)
    
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch (error) {
        console.warn("Error resetting match interface preferences:", error)
      }
    }
  }

  return {
    preferences,
    updatePreferences,
    resetPreferences,
    isLoaded
  }
}