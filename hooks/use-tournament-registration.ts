import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { toast } from "@/components/ui/use-toast"
import type { Tournament } from "@/types"

export function useTournamentRegistration(tournament: Tournament | null) {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isRegistered, setIsRegistered] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)

  // Obtener sesión y datos del usuario
  useEffect(() => {
    let mounted = true
    
    const getSessionAndUser = async () => {
      setIsLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      const authStatus = !!session
      const userId = session?.user?.id || null
      
      setIsAuthenticated(authStatus)
      
      if (authStatus && userId && mounted) {
        try {
          const { data, error } = await supabase
            .from("users")
            .select("*")
            .eq("id", userId)
            .single()
            
          if (error) {
            console.error("Error fetching user data:", error)
            setUser(null)
          } else {
            setUser(data)
          }
        } catch (err) {
          console.error("Unexpected error fetching user:", err)
          setUser(null)
        }
      } else {
        setUser(null)
      }
      if (mounted) setIsLoading(false)
    }
    
    getSessionAndUser()
    
    // Listener for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`Auth event: ${event}`)
      if (mounted) {
         await getSessionAndUser() // Re-check session and user on any auth event
      }
    })

    return () => {
      mounted = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  // Verificar si el usuario ya está inscrito en el torneo
  useEffect(() => {
    const checkRegistration = async () => {
      if (isLoading || !user || !tournament) {
        setIsRegistered(false)
        return
      }
      
      try {
        // Get user's player profile first
        const { data: player, error: playerError } = await supabase
          .from('players')
          .select('id')
          .eq('user_id', user.id)
          .single()

        if (playerError || !player) {
          setIsRegistered(false)
          return
        }

        // Get all inscriptions for this tournament with couple details
        const { data: inscriptions, error: inscriptionError } = await supabase
          .from('inscriptions')
          .select(`
            id,
            couple_id,
            couples!inner (
              id,
              player1_id,
              player2_id
            )
          `)
          .eq('tournament_id', tournament.id)
          .eq('es_prueba', false)

        if (inscriptionError) {
          console.error("Error checking registration:", inscriptionError)
          setIsRegistered(false)
          return
        }

        // Find inscription where current player is either player1 or player2
        const userInscription = inscriptions?.find(inscription => {
          const couple = inscription.couples as any
          return couple.player1_id === player.id || couple.player2_id === player.id
        })

        setIsRegistered(!!userInscription)
      } catch (error) {
        console.error("An unexpected error occurred during registration check:", error)
        setIsRegistered(false)
      }
    }

    checkRegistration()
  }, [tournament, user, isLoading])

  const handleRegister = async () => {
    if (!user || !tournament || isRegistering) return
    
    setIsRegistering(true)
    
    try {
      // Verificar perfil de jugador
      const { data: playerData, error: playerError } = await supabase
        .from("players")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle()
        
      if (playerError || !playerData) {
        toast({
          title: "Error",
          description: playerError?.message || "Debes completar tu perfil de jugador.",
          variant: "destructive"
        })
        if (!playerData) router.push("/profile")
        setIsRegistering(false)
        return
      }
      
      // Registrar inscripción
      const { error } = await supabase
        .from("inscriptions")
        .insert({
          tournament_id: tournament.id,
          player_id: user.id,
          status: "PENDING"
        })
        
      if (error) {
        throw error
      }
      
      setIsRegistered(true)
      toast({
        title: "¡Inscripción exitosa!",
        description: "Te has inscrito correctamente al torneo"
      })
      
    } catch (error: any) {
      console.error("Error al registrarse:", error)
      toast({
        title: "Error",
        description: error.message || "Hubo un problema al registrarte.",
        variant: "destructive"
      })
    } finally {
      setIsRegistering(false)
    }
  }

  return {
    user,
    userLoading: isLoading, // Usamos el estado de carga interno del hook
    isRegistered,
    isRegistering,
    isAuthenticated, // Devolvemos el estado de autenticación detectado
    router,
    handleRegister
  }
} 