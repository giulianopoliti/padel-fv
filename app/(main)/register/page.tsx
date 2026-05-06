"use client"

import type React from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, CheckCircle, Eye, EyeOff, Loader2, UserCheck } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"

import { checkDNIConflictBeforeRegistration, register, registerAndLinkToExistingPlayer } from "./actions"
import { TENANT_CONFIG } from "@/config/tenant"
import BrandLogo from "@/components/ui/brand-logo"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { createClient } from "@/utils/supabase/client"

type ConfirmationState = {
  existingPlayer: {
    id: string
    name: string
    score: number
    category: string
    dni: string | null
    isExistingPlayer: boolean
  }
  message?: string
}

export default function RegisterPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [confirmationData, setConfirmationData] = useState<ConfirmationState | null>(null)
  const [originalFormData, setOriginalFormData] = useState<FormData | null>(null)
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    dni: "",
    phone: "",
    gender: "",
    dateOfBirth: "",
  })

  const redirectTo = searchParams.get("redirectTo")
  const intent = searchParams.get("intent")
  const hasValidRedirect = !!redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")
  const loginHref = hasValidRedirect
    ? `/login?redirectTo=${encodeURIComponent(redirectTo)}${intent === "individual" || intent === "couple" ? `&intent=${intent}` : ""}`
    : "/login"

  useEffect(() => {
    const requestedRole = searchParams.get("role")
    if (requestedRole && requestedRole.toUpperCase() !== "PLAYER") {
      router.replace("/register")
    }
  }, [router, searchParams])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const buildPlayerFormData = () => {
    const data = new FormData()
    data.append("email", formData.email)
    data.append("password", formData.password)
    data.append("role", "PLAYER")
    data.append("firstName", formData.firstName)
    data.append("lastName", formData.lastName)
    data.append("dni", formData.dni)
    data.append("phone", formData.phone)
    data.append("gender", formData.gender)
    data.append("dateOfBirth", formData.dateOfBirth)

    if (hasValidRedirect && redirectTo) {
      data.append("redirectTo", redirectTo)
    }

    if (intent === "individual" || intent === "couple") {
      data.append("intent", intent)
    }

    return data
  }

  const handleGoogleLogin = async () => {
    if (isSubmitting) return

    try {
      setIsSubmitting(true)
      const supabase = createClient()
      const nextUrl = new URL(hasValidRedirect && redirectTo ? redirectTo : "/panel", window.location.origin)

      if (intent === "individual" || intent === "couple") {
        nextUrl.searchParams.set("intent", intent)
      }

      const callbackUrl = new URL("/auth/callback", window.location.origin)
      callbackUrl.searchParams.set("next", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`)

      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callbackUrl.toString() },
      })
    } catch (error) {
      console.error("[REGISTER_PAGE] Google login failed:", error)
      toast({
        title: "Error",
        description: "No se pudo continuar con Google.",
        variant: "destructive",
      })
      setIsSubmitting(false)
    }
  }

  const handleConfirmLinking = async () => {
    if (!confirmationData?.existingPlayer || !originalFormData) return

    setIsSubmitting(true)
    try {
      const result = await registerAndLinkToExistingPlayer(originalFormData, confirmationData.existingPlayer.id)
      setConfirmationData(null)

      if (result?.error) {
        toast({
          title: "Error al vincular cuenta",
          description: result.error,
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Cuenta vinculada",
        description: result.message || "Tu cuenta quedo asociada al jugador existente.",
      })

      setTimeout(() => {
        router.push(result.redirectUrl || "/panel")
      }, 1200)
    } catch (error) {
      console.error("[REGISTER_PAGE] Linking failed:", error)
      toast({
        title: "Error inesperado",
        description: "No pudimos completar la vinculacion.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRejectLinking = () => {
    setConfirmationData(null)
    setOriginalFormData(null)
    toast({
      title: "Revision necesaria",
      description: "No vinculamos el perfil. Podes escribirnos para revisar el caso manualmente.",
    })
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (isSubmitting) return

    setIsSubmitting(true)
    const dataToSubmit = buildPlayerFormData()

    try {
      const conflictCheckResult = await checkDNIConflictBeforeRegistration(dataToSubmit)

      if (!conflictCheckResult.success) {
        if (conflictCheckResult.requiresConfirmation && conflictCheckResult.existingPlayer) {
          setConfirmationData({
            existingPlayer: conflictCheckResult.existingPlayer,
            message: conflictCheckResult.message,
          })
          setOriginalFormData(dataToSubmit)
          toast({
            title: "Jugador encontrado",
            description: "Encontramos un perfil previo que podria ser tuyo.",
          })
          setIsSubmitting(false)
          return
        }

        toast({
          title: "No pudimos completar el registro",
          description: conflictCheckResult.error || "Revisa los datos e intenta nuevamente.",
          variant: "destructive",
        })
        setIsSubmitting(false)
        return
      }

      const result = await register(dataToSubmit)

      if (result?.error) {
        toast({
          title: "Error de registro",
          description: result.error,
          variant: "destructive",
        })
        return
      }

      if (result?.requiresConfirmation && result.existingPlayer) {
        setConfirmationData({
          existingPlayer: result.existingPlayer,
          message: result.message,
        })
        setOriginalFormData(dataToSubmit)
        return
      }

      toast({
        title: "Registro exitoso",
        description: result?.message || "Tu cuenta ya esta lista.",
      })

      setTimeout(() => {
        router.push(result?.redirectUrl || "/panel")
      }, 1200)
    } catch (error) {
      console.error("[REGISTER_PAGE] Submit failed:", error)
      toast({
        title: "Error inesperado",
        description: "No pudimos crear la cuenta. Proba de nuevo.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#f7f7f7_0%,#ffffff_50%,#eef3f9_100%)]">
      <div className="container mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-brand-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al inicio
          </Link>
          <BrandLogo variant="navbar" surface="light" />
        </div>

        <div className="grid flex-1 items-start gap-8 lg:grid-cols-[1fr_0.95fr]">
          <section className="space-y-6 rounded-[2rem] border border-brand-100 bg-white/80 p-8 shadow-sm backdrop-blur-sm lg:p-12">
            <div className="inline-flex items-center rounded-full bg-brand-900 px-4 py-1 text-sm font-medium text-white">
              Alta publica de jugadores
            </div>
            <div className="space-y-4">
              <h1 className="max-w-xl text-4xl font-black tracking-tight text-brand-900 lg:text-5xl">
                Crea tu cuenta para jugar en {TENANT_CONFIG.siteName}.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-600 lg:text-lg">
                Este registro esta pensado para jugadores. Las cuentas con permisos de organizacion se crean
                manualmente dentro del tenant y usan el mismo login.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-brand-100 bg-white p-5">
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Que incluye</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Perfil de jugador, acceso al panel, inscripciones a torneos y seguimiento de tus inscripciones.
                </p>
              </div>
              <div className="rounded-2xl border border-brand-100 bg-white p-5">
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Equipo organizador</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Si necesitas acceso interno, pedilo por soporte. No se habilita desde el registro publico.
                </p>
              </div>
            </div>

            <Alert className="rounded-2xl border-brand-100 bg-brand-50">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription className="text-sm leading-6 text-slate-600">
                Si ya jugaste antes y cargas tu DNI, vamos a intentar vincular tu nueva cuenta con ese perfil existente.
              </AlertDescription>
            </Alert>
          </section>

          <div className="relative">
            {confirmationData?.existingPlayer && (
              <div className="absolute inset-0 z-20 flex items-center justify-center rounded-[2rem] bg-black/50 p-4 backdrop-blur-sm">
                <Card className="w-full max-w-md rounded-[2rem] border-0 shadow-2xl">
                  <CardHeader className="text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-900 text-white">
                      <UserCheck className="h-6 w-6" />
                    </div>
                    <CardTitle className="text-xl">¿Es tu perfil?</CardTitle>
                    <CardDescription className="leading-6">
                      {confirmationData.message || "Encontramos un jugador registrado con ese DNI."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm text-slate-600">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="font-semibold text-slate-900">{confirmationData.existingPlayer.name}</p>
                      <p>Categoria: {confirmationData.existingPlayer.category}</p>
                      <p>Puntaje: {confirmationData.existingPlayer.score}</p>
                    </div>
                    <p>Si confirmas, tu cuenta nueva se va a vincular a ese jugador existente.</p>
                  </CardContent>
                  <CardFooter className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 rounded-xl"
                      onClick={handleRejectLinking}
                      disabled={isSubmitting}
                    >
                      No es mi perfil
                    </Button>
                    <Button
                      type="button"
                      className="flex-1 rounded-xl bg-brand-600 hover:bg-brand-700"
                      onClick={handleConfirmLinking}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Vinculando...
                        </span>
                      ) : (
                        "Si, continuar"
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            )}

            <Card className="overflow-hidden rounded-[2rem] border-0 bg-white shadow-2xl">
              <div className="h-2 bg-gradient-to-r from-brand-700 via-brand-600 to-court-500" />
              <CardHeader className="space-y-3 px-8 pt-8 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-900">
                  <BrandLogo variant="navbar" surface="dark" className="h-10 w-auto" />
                </div>
                <div>
                  <CardTitle className="text-2xl font-bold text-slate-900">Crear cuenta de jugador</CardTitle>
                  <CardDescription className="mt-2 text-sm leading-6 text-slate-600">
                    Completa tus datos para empezar a inscribirte en torneos y gestionar tu perfil.
                  </CardDescription>
                </div>
              </CardHeader>

              <CardContent className="px-8">
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">Nombre</Label>
                      <Input
                        id="firstName"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleInputChange}
                        required
                        className="h-12 rounded-xl border-brand-100"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Apellido</Label>
                      <Input
                        id="lastName"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleInputChange}
                        required
                        className="h-12 rounded-xl border-brand-100"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Correo electronico</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      autoComplete="email"
                      required
                      className="h-12 rounded-xl border-brand-100"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Contraseña</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        value={formData.password}
                        onChange={handleInputChange}
                        autoComplete="new-password"
                        required
                        minLength={6}
                        className="h-12 rounded-xl border-brand-100 pr-12"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-700"
                        aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="dni">DNI opcional</Label>
                      <Input
                        id="dni"
                        name="dni"
                        value={formData.dni}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, "").slice(0, 8)
                          setFormData((prev) => ({ ...prev, dni: value }))
                        }}
                        inputMode="numeric"
                        maxLength={8}
                        className="h-12 rounded-xl border-brand-100"
                        placeholder="Solo numeros"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefono</Label>
                      <Input
                        id="phone"
                        name="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={handleInputChange}
                        className="h-12 rounded-xl border-brand-100"
                        placeholder="+54 9 11 12345678"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="gender">Genero</Label>
                      <Select value={formData.gender} onValueChange={(value) => setFormData((prev) => ({ ...prev, gender: value }))}>
                        <SelectTrigger className="h-12 rounded-xl border-brand-100">
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MALE">Masculino</SelectItem>
                          <SelectItem value="FEMALE">Femenino</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dateOfBirth">Fecha de nacimiento</Label>
                      <Input
                        id="dateOfBirth"
                        name="dateOfBirth"
                        type="date"
                        value={formData.dateOfBirth}
                        onChange={handleInputChange}
                        className="h-12 rounded-xl border-brand-100"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="h-12 w-full rounded-xl bg-brand-600 text-base font-semibold text-white hover:bg-brand-700"
                  >
                    {isSubmitting ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creando cuenta...
                      </span>
                    ) : (
                      "Crear cuenta"
                    )}
                  </Button>

                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-slate-200" />
                    <span className="text-sm text-slate-400">o</span>
                    <div className="h-px flex-1 bg-slate-200" />
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGoogleLogin}
                    disabled={isSubmitting}
                    className="h-12 w-full rounded-xl border-brand-100 text-base font-medium text-brand-700 hover:bg-brand-50"
                  >
                    Continuar con Google
                  </Button>
                </form>
              </CardContent>

              <CardFooter className="flex flex-col gap-4 px-8 pb-8">
                <p className="rounded-2xl bg-brand-50 p-4 text-sm leading-6 text-slate-600">
                  ¿Necesitas acceso como organizador? Escribi a{" "}
                  <a className="font-semibold text-brand-900" href={`mailto:${TENANT_CONFIG.supportEmail}`}>
                    {TENANT_CONFIG.supportEmail}
                  </a>
                  .
                </p>
                <p className="text-center text-sm text-slate-500">
                  ¿Ya tenes una cuenta?{" "}
                  <Link href={loginHref} className="font-semibold text-brand-900 hover:text-brand-700">
                    Iniciar sesion
                  </Link>
                </p>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
