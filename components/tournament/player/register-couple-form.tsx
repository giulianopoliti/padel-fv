"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { registerCoupleForTournament } from "@/app/api/tournaments/actions"
import { checkPlayerIdentity, createPlayerForCouple, checkPlayersPhones, updatePlayerPhone } from "@/app/api/players/actions"
import { useUser } from "@/contexts/user-context"
import { Search, UserPlus, AlertCircle, Users, User, Phone, CreditCard, Loader2, Trophy, Upload, CheckCircle2 } from "lucide-react"
import { Gender } from "@/types"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { toast } from "@/components/ui/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import PlayerDniDisplay from "@/components/players/player-dni-display"

// Define the PlayerInfo interface locally
interface PlayerInfo {
  id: string
  first_name: string | null
  last_name: string | null
  score?: number | null
  dni?: string | null
  phone?: string | null
  category_name?: string | null
}

type IdentityMatchType = "dni" | "name"

// Interface para datos de verificacion de telefono
interface PhoneCheckData {
  id: string
  firstName: string
  lastName: string
  phone: string | null
  needsPhone: boolean
}

const parseJsonResponse = async <T,>(response: Response, fallbackMessage: string): Promise<T> => {
  const responseText = await response.text()

  if (!responseText) {
    return {} as T
  }

  try {
    return JSON.parse(responseText) as T
  } catch (error) {
    console.error("[RegisterCoupleForm] Invalid JSON response", {
      url: response.url,
      status: response.status,
      bodyPreview: responseText.slice(0, 250),
      error,
    })
    throw new Error(fallbackMessage)
  }
}

// Esquema de validación para jugador
const playerFormSchema = z.object({
  firstName: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  lastName: z.string().min(2, "El apellido debe tener al menos 2 caracteres"),
  phone: z
    .string()
    .optional()
    .refine((value) => !value || value.trim().length === 0 || value.trim().length >= 6, {
      message: "El teléfono debe tener al menos 6 caracteres",
    }),
  dni: z.string().optional(),
  gender: z.nativeEnum(Gender),
})

// Esquema de validación para búsqueda
const searchFormSchema = z.object({
  searchTerm: z.string().min(3, "Ingrese al menos 3 caracteres para buscar"),
})

type PlayerFormValues = z.infer<typeof playerFormSchema>
type SearchFormValues = z.infer<typeof searchFormSchema>

interface RegisterCoupleFormProps {
  tournamentId: string
  onComplete: (success: boolean) => void
  players: PlayerInfo[]
  tournamentGender: Gender
  transferConfig?: {
    enabled: boolean
    alias: string | null
    amount: number | null
  }
}

export default function RegisterCoupleForm({
  tournamentId,
  onComplete,
  players,
  tournamentGender,
  transferConfig,
}: RegisterCoupleFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [selectedCompanionId, setSelectedCompanionId] = useState<string | null>(null)
  const [currentPlayerInfo, setCurrentPlayerInfo] = useState<PlayerInfo | null>(null)
  const { user: contextUser, userDetails } = useUser()
  
  // Estados para verificacion de telefonos
  const [isCheckingPhones, setIsCheckingPhones] = useState(false)
  const [phoneCheckResult, setPhoneCheckResult] = useState<{
    player1: PhoneCheckData | null
    player2: PhoneCheckData | null
    atLeastOneHasPhone: boolean
    noneHasPhone: boolean
  } | null>(null)
  const [showPhoneForm, setShowPhoneForm] = useState(false)
  const [player1Phone, setPlayer1Phone] = useState("")
  const [player2Phone, setPlayer2Phone] = useState("")
  const [isUpdatingPhones, setIsUpdatingPhones] = useState(false)
  const [showIdentityModal, setShowIdentityModal] = useState(false)
  const [existingIdentityPlayer, setExistingIdentityPlayer] = useState<PlayerInfo | null>(null)
  const [identityMatchedBy, setIdentityMatchedBy] = useState<IdentityMatchType>("name")
  const [pendingNewPlayerData, setPendingNewPlayerData] = useState<PlayerFormValues | null>(null)
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null)
  const [paymentProofError, setPaymentProofError] = useState<string | null>(null)

  const transferProofEnabled = !!transferConfig?.enabled
  const transferAlias = transferConfig?.alias?.trim() || null
  const transferAmount = transferConfig?.amount ?? null
  const transferConfigInvalid = transferProofEnabled && (!transferAlias || transferAmount === null || transferAmount <= 0)

  // Obtener información del jugador logueado
  useEffect(() => {
    if (userDetails?.player_id) {
      const playerInfo = players.find(p => p.id === userDetails.player_id)
      setCurrentPlayerInfo(playerInfo || null)
    }
  }, [userDetails, players])

  // Formulario para registrar nuevo jugador
  const playerForm = useForm<PlayerFormValues>({
    resolver: zodResolver(playerFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      phone: "",
      dni: "",
      gender: tournamentGender === Gender.FEMALE ? Gender.FEMALE : Gender.MALE,
    },
  })

  // Formulario para buscar jugador existente
  const searchForm = useForm<SearchFormValues>({
    resolver: zodResolver(searchFormSchema),
    defaultValues: {
      searchTerm: "",
    },
  })

  // Manejar búsqueda de jugadores
  const onSearch = async (data: SearchFormValues) => {
    setIsSearching(true)
    setSearchResults([])
    try {
      console.log('[RegisterCoupleForm] Searching with term:', data.searchTerm)

      // ✅ Llamar Edge Function para búsqueda optimizada
      const { searchTournamentPlayers } = await import('@/lib/api/supabase-edge')
      const result = await searchTournamentPlayers({
        searchTerm: data.searchTerm,
        tournamentId,
        page: 1,
        pageSize: 50
      })

      if (result.success && result.players) {
        // Excluir al jugador logueado de los resultados
        const filteredResults = result.players.filter(
          (player: any) => player.id !== userDetails?.player_id
        )
        console.log('[RegisterCoupleForm] Found:', filteredResults.length, 'players')
        setSearchResults(filteredResults)
      } else {
        console.warn('[RegisterCoupleForm] No players found or error:', result.error)
        setSearchResults([])
      }
    } catch (error) {
      console.error("Error al buscar jugadores:", error)
      setSearchResults([])
      toast({
        title: "Error en la búsqueda",
        description: "No se pudieron buscar jugadores. Intenta nuevamente.",
        variant: "destructive",
      })
    } finally {
      setIsSearching(false)
    }
  }

  // Manejar selección de compañero
  const handleSelectCompanion = (playerId: string) => {
    setSelectedCompanionId(playerId)
    // Resetear estados de verificacion de telefono al cambiar de compañero
    setPhoneCheckResult(null)
    setShowPhoneForm(false)
    setPlayer1Phone("")
    setPlayer2Phone("")
  }

  // Verificar telefonos antes de registrar pareja
  const handleCheckPhonesAndRegister = async (companionId = selectedCompanionId) => {
    if (!userDetails?.player_id || !companionId) {
      toast({
        title: "Selección incompleta",
        description: "Debe seleccionar un compañero para formar la pareja",
        variant: "destructive",
      })
      return false
    }

    if (!validateTransferProofRequirements()) {
      return false
    }

    setIsCheckingPhones(true)

    try {
      console.log("[RegisterCoupleForm] Verificando telefonos de jugadores...")
      const result = await checkPlayersPhones(userDetails.player_id, companionId)

      if (!result.success) {
        toast({
          title: "Error de verificación",
          description: result.error || "No se pudo verificar los teléfonos",
          variant: "destructive",
        })
        return false
      }

      setPhoneCheckResult({
        player1: result.player1,
        player2: result.player2,
        atLeastOneHasPhone: result.atLeastOneHasPhone,
        noneHasPhone: result.noneHasPhone
      })
      setSelectedCompanionId(companionId)
      setPlayer1Phone(result.player1?.needsPhone ? result.player1.phone || "" : "")
      setPlayer2Phone(result.player2?.needsPhone ? result.player2.phone || "" : "")

      // Si al menos uno tiene telefono, proceder con el registro directamente
      if (result.atLeastOneHasPhone) {
        console.log("[RegisterCoupleForm] Al menos un jugador tiene telefono, procediendo con registro...")
        return await registerCoupleWithCompanion(companionId)
      } else {
        // Ninguno tiene telefono, mostrar formulario para agregar al menos uno
        console.log("[RegisterCoupleForm] Ningun jugador tiene telefono, mostrando formulario...")
        setShowPhoneForm(true)
        return false
      }
    } catch (error) {
      console.error("[RegisterCoupleForm] Error al verificar telefonos:", error)
      toast({
        title: "Error inesperado",
        description: "Ocurrió un error al verificar los teléfonos",
        variant: "destructive",
      })
      return false
    } finally {
      setIsCheckingPhones(false)
    }
  }

  // Actualizar telefonos faltantes y luego registrar
  // Solo se requiere agregar AL MENOS UN telefono si ninguno tiene
  const handleUpdatePhonesAndRegister = async () => {
    if (!phoneCheckResult) return

    const player1PhoneValid = player1Phone && player1Phone.trim().length >= 6
    const player2PhoneValid = player2Phone && player2Phone.trim().length >= 6

    // Validar que al menos uno tenga telefono valido
    if (!player1PhoneValid && !player2PhoneValid) {
      toast({
        title: "Telefono requerido",
        description: "Debes agregar el telefono de al menos uno de los jugadores",
        variant: "destructive",
      })
      return
    }

    setIsUpdatingPhones(true)

    try {
      // Actualizar telefono del jugador 1 si se proporciono
      if (player1PhoneValid && phoneCheckResult.player1?.needsPhone && phoneCheckResult.player1.id) {
        console.log(`[RegisterCoupleForm] Actualizando telefono de player1: ${phoneCheckResult.player1.id}`)
        const updateResult = await updatePlayerPhone(phoneCheckResult.player1.id, player1Phone)
        if (!updateResult.success) {
          toast({
            title: "Error al actualizar telefono",
            description: updateResult.error || "No se pudo actualizar el telefono",
            variant: "destructive",
          })
          return
        }
      }

      // Actualizar telefono del jugador 2 si se proporciono
      if (player2PhoneValid && phoneCheckResult.player2?.needsPhone && phoneCheckResult.player2.id) {
        console.log(`[RegisterCoupleForm] Actualizando telefono de player2: ${phoneCheckResult.player2.id}`)
        const updateResult = await updatePlayerPhone(phoneCheckResult.player2.id, player2Phone)
        if (!updateResult.success) {
          toast({
            title: "Error al actualizar telefono",
            description: updateResult.error || "No se pudo actualizar el telefono",
            variant: "destructive",
          })
          return
        }
      }

      // Proceder con el registro
      await executeRegistration()
    } catch (error) {
      console.error("[RegisterCoupleForm] Error al actualizar telefonos:", error)
      toast({
        title: "Error inesperado",
        description: "Ocurrió un error al actualizar los teléfonos",
        variant: "destructive",
      })
    } finally {
      setIsUpdatingPhones(false)
    }
  }

  // Ejecutar el registro de la pareja
  const executeRegistration = async () => {
    if (!userDetails?.player_id) {
      toast({
        title: "Error de autenticación",
        description: "No se pudo obtener tu información de jugador",
        variant: "destructive",
      })
      return
    }

    if (!selectedCompanionId) {
      toast({
        title: "Selección incompleta",
        description: "Debe seleccionar un compañero para formar la pareja",
        variant: "destructive",
      })
      return
    }

    if (!validateTransferProofRequirements()) {
      return
    }

    setIsSubmitting(true)

    try {
      const result = await submitCoupleRegistration(selectedCompanionId)

      if (result.success) {
        toast({
          title: transferProofEnabled ? "Inscripción registrada" : "Pareja registrada",
          description: transferProofEnabled
            ? "Tu pareja quedó registrada y pendiente de revisión del organizador"
            : "Te has registrado exitosamente en pareja para el torneo",
        })
        onComplete(true)
      } else {
        console.error('[RegisterCoupleForm] Registration error:', result.error)
        toast({
          title: "Error en el registro",
          description: result.error || "No se pudo registrar la pareja",
          variant: "destructive",
        })
        onComplete(false)
      }
    } catch (error) {
      console.error("Error al registrar pareja:", error)
      toast({
        title: "Error inesperado",
        description: error instanceof Error ? error.message : "Ocurrió un error al procesar la solicitud",
        variant: "destructive",
      })
      onComplete(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Manejar registro de pareja con compañero existente (mantener por compatibilidad)
  const onSubmitCouple = async () => {
    await handleCheckPhonesAndRegister()
  }

  const registerCoupleWithCompanion = async (companionId: string) => {
    if (!userDetails?.player_id) {
      toast({
        title: "Error de usuario",
        description: "No se pudo obtener tu ID de jugador. Verifica tu perfil.",
        variant: "destructive",
      })
      return false
    }

    const result = await submitCoupleRegistration(companionId)

    if (result.success) {
      toast({
        title: transferProofEnabled ? "Inscripción registrada" : "¡Pareja registrada!",
        description: transferProofEnabled
          ? "La pareja quedó registrada y pendiente de revisión del organizador"
          : "Se ha registrado la pareja exitosamente",
      })
      onComplete(true)
      return true
    }

    console.error("[RegisterCoupleForm] Couple registration error:", result.error)
    toast({
      title: "Error en el registro de pareja",
      description: result.error || "No se pudo registrar la pareja",
      variant: "destructive",
    })
    onComplete(false)
    return false
  }

  const createAndRegisterCompanion = async (
    data: PlayerFormValues,
    forceCreateNew = false,
  ) => {
    const newPlayerResult = await createPlayerForCouple({
      tournamentId,
      playerData: {
        first_name: data.firstName,
        last_name: data.lastName,
        gender: data.gender,
        dni: data.dni || null,
        phone: data.phone,
        forceCreateNew,
      },
    })

    if (!newPlayerResult.success || !newPlayerResult.playerId) {
      toast({
        title: "Error al crear jugador",
        description: newPlayerResult.message || "No se pudo crear el nuevo jugador",
        variant: "destructive",
      })
      onComplete(false)
      return false
    }

    return handleCheckPhonesAndRegister(newPlayerResult.playerId)
  }

  const resetIdentityModalState = () => {
    setShowIdentityModal(false)
    setExistingIdentityPlayer(null)
    setIdentityMatchedBy("name")
    setPendingNewPlayerData(null)
  }

  const handleUseExistingIdentityPlayer = async () => {
    if (!existingIdentityPlayer?.id) return

    setShowIdentityModal(false)
    setIsSubmitting(true)
    try {
      await handleCheckPhonesAndRegister(existingIdentityPlayer.id)
    } catch (error) {
      console.error("[RegisterCoupleForm] Error al registrar con jugador existente:", error)
      toast({
        title: "Error inesperado",
        description: "Ocurrió un error al registrar la pareja",
        variant: "destructive",
      })
      onComplete(false)
    } finally {
      setIsSubmitting(false)
      resetIdentityModalState()
    }
  }

  const handleCreateNewAfterIdentityPrompt = async () => {
    if (!pendingNewPlayerData) return

    setShowIdentityModal(false)
    setIsSubmitting(true)
    try {
      await createAndRegisterCompanion(pendingNewPlayerData, true)
    } catch (error) {
      console.error("[RegisterCoupleForm] Error al crear jugador forzado:", error)
      toast({
        title: "Error inesperado",
        description: "Ocurrió un error al crear y registrar el compañero",
        variant: "destructive",
      })
      onComplete(false)
    } finally {
      setIsSubmitting(false)
      resetIdentityModalState()
    }
  }

  // Manejar registro de nuevo jugador como pareja
  const onSubmitNewPlayer = async (data: PlayerFormValues) => {
    if (!contextUser) {
      toast({
        title: "Error de autenticación",
        description: "Debe iniciar sesión para registrar una pareja",
        variant: "destructive",
      })
      return
    }

    if (!userDetails?.player_id) {
      toast({
        title: "Error de usuario",
        description: "No se pudo obtener tu ID de jugador. Verifica tu perfil.",
        variant: "destructive",
      })
      return
    }

    if (!validateTransferProofRequirements()) {
      return
    }

    setIsSubmitting(true)

    try {
      const normalizedDni = data.dni?.trim() || ""
      const identityData = await checkPlayerIdentity({
        firstName: data.firstName,
        lastName: data.lastName,
        dni: normalizedDni || null,
        gender: data.gender,
      })

      if (!identityData.success) {
        throw new Error(identityData.error || "No se pudo verificar la identidad del jugador")
      }

      if (identityData.exists && identityData.player) {
        setExistingIdentityPlayer(identityData.player)
        setIdentityMatchedBy(identityData.matchedBy || "name")
        setPendingNewPlayerData(data)
        setShowIdentityModal(true)
        return
      }

      await createAndRegisterCompanion(data, false)
      return

      /*
      // Crear el nuevo jugador usando createPlayerForCouple
      const newPlayerResult = await createPlayerForCouple({
        tournamentId,
        playerData: {
          first_name: data.firstName,
          last_name: data.lastName,
          gender: data.gender,
          dni: data.dni || null
        }
      })

      if (newPlayerResult.success && newPlayerResult.playerId) {
        // Registrar la pareja con el nuevo jugador usando la función correcta
        const result = await registerCoupleForTournament(tournamentId, userDetails.player_id, newPlayerResult.playerId)
        
        if (result.success) {
          toast({
            title: "¡Pareja registrada!",
            description: "Se ha registrado la pareja con el nuevo jugador exitosamente",
          })
          onComplete(true)
        } else {
          console.error('[RegisterCoupleForm] New player registration error:', result.error)
          toast({
            title: "Error en el registro de pareja",
            description: result.error || "El jugador se creó pero no se pudo registrar la pareja",
            variant: "destructive",
          })
          onComplete(false)
        }
      } else {
        toast({
          title: "Error al crear jugador",
          description: newPlayerResult.message || "No se pudo crear el nuevo jugador",
          variant: "destructive",
        })
        onComplete(false)
      }
      */
    } catch (error) {
      console.error("Error al registrar pareja:", error)
      toast({
        title: "Error inesperado",
        description: error instanceof Error ? error.message : "Ocurrió un error al procesar la solicitud",
        variant: "destructive",
      })
      onComplete(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const identityModalDescription =
    identityMatchedBy === "dni"
      ? `Coincide por DNI (${existingIdentityPlayer?.dni || "informado"}). ¿El jugador es este?`
      : "Coincide por nombre y apellido. ¿El jugador es este?"

  const submitCoupleRegistration = async (companionId: string) => {
    if (!userDetails?.player_id) {
      return {
        success: false,
        error: "No se pudo obtener tu ID de jugador. Verifica tu perfil.",
      }
    }

    if (transferProofEnabled) {
      const validationError = getTransferProofValidationError()

      if (validationError) {
        setPaymentProofError(validationError)
        return {
          success: false,
          error: validationError,
        }
      }

      const proofFile = paymentProofFile
      if (!proofFile) {
        return {
          success: false,
          error: "Debes adjuntar un comprobante para registrar tu pareja.",
        }
      }

      const formData = new FormData()
      formData.append("player1Id", userDetails.player_id)
      formData.append("player2Id", companionId)
      formData.append("proof", proofFile)

      const response = await fetch(`/api/tournaments/${tournamentId}/inscriptions/couple-with-proof`, {
        method: "POST",
        body: formData,
      })

      const result = await parseJsonResponse<{ message?: string }>(
        response,
        "El servidor devolvió una respuesta inválida al registrar la pareja.",
      )

      if (!response.ok) {
        return {
          success: false,
          error: result.message || "No se pudo registrar la pareja con comprobante.",
        }
      }

      return { success: true }
    }

    console.log("[RegisterCoupleForm] Llamando registerCoupleForTournament")
    console.log("Player IDs:", { player1Id: userDetails.player_id, player2Id: companionId })

    return await registerCoupleForTournament(tournamentId, userDetails.player_id, companionId)
  }

  const formatTransferAmount = (amount: number | null) => {
    if (amount === null || Number.isNaN(Number(amount))) return "Monto no disponible"
    return `$${Number(amount).toLocaleString("es-AR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`
  }

  const getTransferProofValidationError = () => {
    if (!transferProofEnabled) return null

    if (transferConfigInvalid) {
      return "El organizador no configuró correctamente alias y monto para esta inscripción."
    }

    if (!paymentProofFile) {
      return "Debes adjuntar un comprobante para registrar tu pareja."
    }

    return null
  }

  const validateTransferProofRequirements = () => {
    const validationError = getTransferProofValidationError()
    setPaymentProofError(validationError)

    if (!validationError) {
      return true
    }

    toast({
      title: "Faltan datos para inscribirte",
      description: validationError,
      variant: "destructive",
    })

    return false
  }

  const selectedCompanion =
    (selectedCompanionId && searchResults.find((player) => player.id === selectedCompanionId)) ||
    (selectedCompanionId && players.find((player) => player.id === selectedCompanionId)) ||
    null

  const isTransferStepReady = !transferProofEnabled || (!!paymentProofFile && !transferConfigInvalid)

  const renderTransferProofStep = (stepLabel: string, inputId: string, companionName?: string | null) => (
    <div className="space-y-4 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-emerald-100 p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
          <CreditCard className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">{stepLabel}</p>
          <h3 className="text-lg font-semibold text-slate-900 sm:text-xl">Transferi y subi el comprobante</h3>
          <p className="text-sm text-slate-700 sm:text-base">
            Cuando adjuntas el comprobante, la inscripcion queda registrada.
          </p>
        </div>
      </div>

      {companionName && (
        <div className="rounded-xl border border-emerald-200 bg-white/90 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Pareja seleccionada</p>
          <p className="mt-1 text-base font-semibold text-slate-900 sm:text-lg">{companionName}</p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-white/80 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Alias</p>
          <p className="mt-2 break-all text-lg font-semibold text-slate-900 sm:text-xl">
            {transferAlias || "No disponible"}
          </p>
        </div>
        <div className="rounded-xl border border-white/80 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Importe</p>
          <p className="mt-2 text-lg font-semibold text-slate-900 sm:text-xl">
            {formatTransferAmount(transferAmount)}
          </p>
        </div>
      </div>

      {transferConfigInvalid && (
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertTitle className="text-red-800">Configuracion incompleta</AlertTitle>
          <AlertDescription className="text-red-700">
            El organizador todavia no configuro correctamente el alias y el monto de esta inscripcion.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-3">
        <input
          id={inputId}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.pdf"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0] || null
            setPaymentProofFile(file)
            if (transferConfigInvalid) {
              setPaymentProofError("El organizador no configuró correctamente alias y monto para esta inscripción.")
            } else if (file) {
              setPaymentProofError(null)
            } else {
              setPaymentProofError("Debes adjuntar un comprobante para registrar tu pareja.")
            }
          }}
        />

        <label
          htmlFor={inputId}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-white px-5 py-8 text-center transition-colors ${
            paymentProofError
              ? "border-red-400 bg-red-50"
              : "border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50"
          }`}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            {paymentProofFile ? <CheckCircle2 className="h-7 w-7" /> : <Upload className="h-7 w-7" />}
          </div>
          <p className="mt-4 text-base font-semibold text-slate-900 sm:text-lg">
            {paymentProofFile ? "Comprobante cargado" : "Subir comprobante"}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            JPG, PNG, WEBP o PDF
          </p>
          {paymentProofFile && (
            <p className="mt-3 max-w-full break-all text-sm font-medium text-emerald-700">
              {paymentProofFile.name}
            </p>
          )}
        </label>

        {paymentProofError && (
          <p className="text-sm font-medium text-red-600">
            {paymentProofError}
          </p>
        )}
      </div>
    </div>
  )

  if (!userDetails?.player_id) {
    return (
      <Card className="w-full bg-white border border-gray-200 shadow-sm">
        <CardContent className="p-6">
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertTitle className="text-red-800">Error de autenticación</AlertTitle>
            <AlertDescription className="text-red-700">
              Debes estar logueado como jugador para inscribir una pareja.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full bg-white border border-gray-200 shadow-sm">
      <CardHeader className="text-center pb-4">
        <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
          <Users className="h-6 w-6 text-blue-600" />
        </div>
        <CardTitle className="text-xl font-semibold text-gray-900">Inscripción en Pareja</CardTitle>
        <p className="text-sm text-gray-600">
          Primero carga a tu compañero. Si todavía no tiene cuenta, puedes crearle un perfil básico acá mismo.
        </p>
      </CardHeader>

      <CardContent>
        {/* Mostrar información del jugador logueado */}
        <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Paso 1</p>
          <h3 className="mt-2 text-base font-semibold text-slate-900">Tu lugar en la pareja</h3>
          <div className="mt-2 text-blue-700">
            {currentPlayerInfo 
              ? `${currentPlayerInfo.first_name || ""} ${currentPlayerInfo.last_name || ""}`.trim() || "Tu perfil"
              : "Tu perfil"
            }
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Paso 2</p>
          <h3 className="mt-2 text-base font-semibold text-slate-900">Cómo quieres cargar a tu compañero</h3>
          <p className="mt-1 text-sm text-slate-600">
            Usa <span className="font-semibold text-slate-800">Nuevo compañero</span> si todavía no tiene cuenta o nunca fue cargado.
            Si ya existe en el sistema, usa <span className="font-semibold text-slate-800">Ya está cargado</span>.
          </p>
        </div>

        <Tabs defaultValue="new" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-gray-100">
            <TabsTrigger value="new" className="data-[state=active]:bg-white data-[state=active]:text-blue-600">
              <UserPlus className="mr-2 h-4 w-4" />
              Nuevo compañero
            </TabsTrigger>
            <TabsTrigger value="search" className="data-[state=active]:bg-white data-[state=active]:text-blue-600">
              <Search className="mr-2 h-4 w-4" />
              Ya está cargado
            </TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="space-y-4 py-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Compañero ya cargado</p>
              <h3 className="mt-2 text-base font-semibold text-slate-900">Busca a alguien que ya exista en el sistema</h3>
              <p className="mt-1 text-sm text-slate-600">
                Usa esta opción solo si tu compañero ya tiene cuenta o ya fue cargado antes en un torneo o por un club.
              </p>
            </div>

            <Form {...searchForm}>
              <form onSubmit={searchForm.handleSubmit(onSearch)} className="space-y-4">
                <FormField
                  control={searchForm.control}
                  name="searchTerm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">
                        Buscar compañero ya cargado
                      </FormLabel>
                      <FormControl>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Input
                            placeholder="Nombre, apellido o DNI del compañero"
                            className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                            {...field}
                          />
                          <Button
                            type="submit"
                            disabled={isSearching}
                            className="w-full bg-blue-600 text-white hover:bg-blue-700 sm:w-auto"
                          >
                            <Search className="h-4 w-4" />
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>

            {isSearching ? (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-gray-600">Buscando jugadores...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {searchResults.length > 0 ? (
                  searchResults.map((player) => (
                    <div 
                      key={player.id} 
                      className={`rounded-2xl border p-4 cursor-pointer transition-colors ${
                        selectedCompanionId === player.id 
                          ? 'border-blue-500 bg-blue-50 shadow-sm' 
                          : 'border-gray-200 hover:border-gray-300 hover:bg-slate-50'
                      }`}
                      onClick={() => handleSelectCompanion(player.id)}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-base font-semibold text-gray-900">
                            {player.first_name} {player.last_name}
                          </p>
                          {player.score !== null && (
                            <p className="mt-1 text-sm text-gray-600">
                              Puntaje: {player.score}
                            </p>
                          )}
                          <div className="mt-1 text-sm text-gray-600">
                            <PlayerDniDisplay dni={player.dni} />
                          </div>
                        </div>
                        {selectedCompanionId === player.id && (
                          <div className="shrink-0 rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700">
                            Seleccionado
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : searchForm.watch('searchTerm') && !isSearching ? (
                  <p className="text-gray-500 text-center py-4">
                    No se encontraron jugadores con ese criterio
                  </p>
                ) : null}
              </div>
            )}

            {selectedCompanionId && !showPhoneForm && (
              <div className="space-y-4 pt-4">
                {transferProofEnabled && renderTransferProofStep(
                  "Paso 3",
                  "payment-proof-search",
                  selectedCompanion
                    ? `${selectedCompanion.first_name || ""} ${selectedCompanion.last_name || ""}`.trim()
                    : "Compañero seleccionado"
                )}

                {!transferProofEnabled && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-sm font-medium text-emerald-800">
                      La pareja ya está lista para registrarse.
                    </p>
                  </div>
                )}

                <div className="flex justify-end">
                <Button
                  onClick={onSubmitCouple}
                  disabled={isSubmitting || isCheckingPhones || !isTransferStepReady}
                  className="w-full bg-blue-600 text-white hover:bg-blue-700 sm:w-auto"
                >
                  {isCheckingPhones ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verificando...
                    </>
                  ) : isSubmitting ? (
                    "Procesando..."
                  ) : (
                    transferProofEnabled ? "Registrar con comprobante" : "Registrar pareja"
                  )}
                </Button>
                </div>
              </div>
            )}

            {/* Formulario para telefonos faltantes */}
            {showPhoneForm && phoneCheckResult && (
              <div className="mt-4 p-4 border border-amber-200 bg-amber-50 rounded-lg space-y-4">
                <Alert className="border-amber-300 bg-amber-100">
                  <Phone className="h-4 w-4 text-amber-600" />
                  <AlertTitle className="text-amber-800">Telefono requerido</AlertTitle>
                  <AlertDescription className="text-amber-700">
                    Para completar la inscripción necesitamos al menos un teléfono de contacto de la pareja. Con que uno de los dos lo cargue aquí, alcanza.
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  {/* Telefono del jugador 1 (usuario actual) */}
                  {phoneCheckResult.player1?.needsPhone && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        Tu teléfono ({phoneCheckResult.player1.firstName} {phoneCheckResult.player1.lastName})
                      </label>
                      <Input
                        type="tel"
                        placeholder="Ingresa tu numero de telefono"
                        value={player1Phone}
                        onChange={(e) => setPlayer1Phone(e.target.value)}
                        className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                        aria-label={`Telefono de ${phoneCheckResult.player1.firstName}`}
                      />
                      <p className="text-xs text-gray-500">Minimo 6 caracteres</p>
                    </div>
                  )}

                  {/* Telefono del jugador 2 (companero) */}
                  {phoneCheckResult.player2?.needsPhone && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        Teléfono de tu compañero ({phoneCheckResult.player2.firstName} {phoneCheckResult.player2.lastName})
                      </label>
                      <Input
                        type="tel"
                        placeholder="Ingresa el numero de telefono del companero"
                        value={player2Phone}
                        onChange={(e) => setPlayer2Phone(e.target.value)}
                        className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                        aria-label={`Telefono de ${phoneCheckResult.player2.firstName}`}
                      />
                      <p className="text-xs text-gray-500">Minimo 6 caracteres</p>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowPhoneForm(false)
                      setPhoneCheckResult(null)
                      setPlayer1Phone("")
                      setPlayer2Phone("")
                    }}
                    disabled={isUpdatingPhones || isSubmitting}
                    className="border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleUpdatePhonesAndRegister}
                    disabled={isUpdatingPhones || isSubmitting}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {isUpdatingPhones || isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Procesando...
                      </>
                    ) : (
                      "Guardar y registrar pareja"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="new" className="py-4">
            <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Nuevo compañero</p>
              <h3 className="mt-2 text-base font-semibold text-slate-900">Tu compañero todavía no tiene cuenta</h3>
              <p className="mt-1 text-sm text-slate-600">
                Completa sus datos para crearle un perfil básico y continuar. No necesita tener cuenta para que puedas inscribir la pareja.
              </p>
            </div>
            
            <Form {...playerForm}>
              <form onSubmit={playerForm.handleSubmit(onSubmitNewPlayer)} className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormField
                    control={playerForm.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-gray-700">
                          <User className="h-4 w-4 inline mr-1" />
                          Nombre
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Nombre del compañero"
                            className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={playerForm.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-gray-700">Apellido</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Apellido del compañero"
                            className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                  <FormField
                    control={playerForm.control}
                    name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">
                        <Phone className="h-4 w-4 inline mr-1" />
                        Teléfono
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Teléfono del compañero"
                          className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                          {...field}
                        />
                      </FormControl>
                      <p className="text-xs text-gray-500">
                        Opcional si al menos uno de los dos ya tiene teléfono cargado.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={playerForm.control}
                  name="dni"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">
                        <CreditCard className="h-4 w-4 inline mr-1" />
                        DNI opcional
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Puedes dejarlo vacío y cargarlo después"
                          className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={playerForm.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">Género</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccione el género" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem 
                            value={Gender.MALE}
                            disabled={tournamentGender === Gender.FEMALE}
                          >
                            Masculino
                          </SelectItem>
                          <SelectItem value={Gender.FEMALE}>Femenino</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {transferProofEnabled && renderTransferProofStep("Paso 3", "payment-proof-new")}

                <div className="flex flex-col-reverse gap-2 pt-4 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onComplete(false)}
                    disabled={isSubmitting}
                    className="border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting || !isTransferStepReady}
                    className="w-full bg-blue-600 text-white hover:bg-blue-700 sm:w-auto"
                  >
                    {isSubmitting ? "Procesando..." : "Crear y registrar pareja"}
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </CardContent>

      {showIdentityModal && existingIdentityPlayer && (
        <Dialog open={showIdentityModal} onOpenChange={(open) => !open && resetIdentityModalState()}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-600" />
                El jugador es este?
              </DialogTitle>
              <DialogDescription>{identityModalDescription}</DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                <h4 className="font-semibold text-blue-900">Datos del jugador encontrado:</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-600">Nombre:</span>
                    <span className="font-semibold text-slate-800">
                      {existingIdentityPlayer.first_name} {existingIdentityPlayer.last_name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-600">DNI:</span>
                    <PlayerDniDisplay dni={existingIdentityPlayer.dni} className="font-semibold text-slate-800" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-600">Puntaje:</span>
                    <div className="flex items-center gap-1">
                      <Trophy className="h-4 w-4 text-yellow-500" />
                      <span className="font-semibold text-slate-800">{existingIdentityPlayer.score ?? "No disponible"}</span>
                    </div>
                  </div>
                  {existingIdentityPlayer.category_name && (
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-600">Categoria:</span>
                      <span className="font-semibold text-slate-800">{existingIdentityPlayer.category_name}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={handleCreateNewAfterIdentityPrompt}
                className="w-full sm:w-auto"
                disabled={isSubmitting}
              >
                No usar, crear nuevo
              </Button>
              <Button
                onClick={handleUseExistingIdentityPlayer}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
                disabled={isSubmitting}
              >
                Usar este jugador
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  )
}
