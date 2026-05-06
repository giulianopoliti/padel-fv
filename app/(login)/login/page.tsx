"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react"
import { useSearchParams } from "next/navigation"

import { login } from "@/app/(login)/login/actions"
import { TENANT_CONFIG } from "@/config/tenant"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import BrandLogo from "@/components/ui/brand-logo"
import { useToast } from "@/components/ui/use-toast"
import { createClient } from "@/utils/supabase/client"

export default function LoginPage() {
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const [mounted, setMounted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  const redirectTo = searchParams.get("redirectTo")
  const intent = searchParams.get("intent")
  const hasValidRedirect = !!redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")
  const registerHref = hasValidRedirect
    ? `/register?redirectTo=${encodeURIComponent(redirectTo)}${intent === "individual" || intent === "couple" ? `&intent=${intent}` : ""}`
    : "/register"

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (isSubmitting) return

    try {
      setIsSubmitting(true)

      const data = new FormData()
      data.append("email", formData.email)
      data.append("password", formData.password)

      if (hasValidRedirect && redirectTo) {
        data.append("redirectTo", redirectTo)
      }

      if (intent === "individual" || intent === "couple") {
        data.append("intent", intent)
      }

      const result = await login(data)

      if (!result || typeof result !== "object") {
        toast({
          title: "Error de comunicacion",
          description: "No se recibio una respuesta valida. Intenta nuevamente.",
          variant: "destructive",
        })
        return
      }

      if (result.error) {
        toast({
          title: "Error de acceso",
          description: result.error,
          variant: "destructive",
        })
        return
      }

      if (result.success) {
        toast({
          title: "Acceso exitoso",
          description: result.message || "Redirigiendo...",
        })
        window.location.href = result.redirectUrl || "/panel"
        return
      }

      toast({
        title: "Error inesperado",
        description: "La respuesta del servidor no tuvo el formato esperado.",
        variant: "destructive",
      })
    } catch (error) {
      console.error("[LOGIN_PAGE] Login failed:", error)
      toast({
        title: "Error de red",
        description: "No pudimos iniciar sesion. Proba de nuevo en unos minutos.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
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
      console.error("[LOGIN_PAGE] Google login failed:", error)
      toast({
        title: "Error",
        description: "No se pudo iniciar sesion con Google.",
        variant: "destructive",
      })
      setIsSubmitting(false)
    }
  }

  if (!mounted) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="container mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al inicio
          </Link>
          <BrandLogo />
        </div>

        <div className="grid flex-1 items-center gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="space-y-6 rounded-[2rem] border border-slate-200 bg-white/70 p-8 shadow-sm backdrop-blur-sm lg:p-12">
            <div className="inline-flex items-center rounded-full bg-slate-900 px-4 py-1 text-sm font-medium text-white">
              Acceso unificado
            </div>
            <div className="space-y-4">
              <h1 className="max-w-xl text-4xl font-black tracking-tight text-slate-900 lg:text-5xl">
                Ingresa a {TENANT_CONFIG.siteName} desde un unico acceso.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-600 lg:text-lg">
                Jugadores y organizadores usan el mismo login. Si tu cuenta tiene permisos de organizacion,
                el sistema te lleva automaticamente a tu panel.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Jugadores</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Podes registrarte desde este mismo sitio, gestionar tu perfil e inscribirte a torneos.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Organizacion</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Las cuentas con permisos de organizacion se habilitan manualmente y comparten este mismo acceso.
                </p>
              </div>
            </div>
          </section>

          <Card className="overflow-hidden rounded-[2rem] border-0 bg-white shadow-2xl">
            <div className="h-2 bg-gradient-to-r from-slate-700 via-slate-900 to-black" />
            <CardHeader className="space-y-3 px-8 pt-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900">
                <BrandLogo className="h-10 w-auto text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold text-slate-900">Iniciar sesion</CardTitle>
                <CardDescription className="mt-2 text-sm leading-6 text-slate-600">
                  Usa tu email y contraseña. Si ya sos parte del staff organizador, vas a entrar con ese mismo usuario.
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="px-8">
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email">Correo electronico</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="tu@email.com"
                    autoComplete="email"
                    required
                    disabled={isSubmitting}
                    className="h-12 rounded-xl border-slate-200"
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
                      autoComplete="current-password"
                      required
                      disabled={isSubmitting}
                      className="h-12 rounded-xl border-slate-200 pr-12"
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

                <div className="flex justify-end">
                  <Link href="/forgot-password" className="text-sm font-medium text-slate-600 hover:text-slate-900">
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-12 w-full rounded-xl bg-slate-900 text-base font-semibold text-white hover:bg-black"
                >
                  {isSubmitting ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Ingresando...
                    </span>
                  ) : (
                    "Ingresar"
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
                  className="h-12 w-full rounded-xl border-slate-200 text-base font-medium text-slate-700 hover:bg-slate-50"
                >
                  Continuar con Google
                </Button>
              </form>
            </CardContent>

            <CardFooter className="flex flex-col gap-4 px-8 pb-8">
              <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                Si necesitas acceso como organizador y todavia no lo tenes habilitado, escribi a{" "}
                <a className="font-semibold text-slate-900" href={`mailto:${TENANT_CONFIG.supportEmail}`}>
                  {TENANT_CONFIG.supportEmail}
                </a>
                .
              </div>
              <p className="text-center text-sm text-slate-500">
                ¿Todavia no tenes cuenta?{" "}
                <Link href={registerHref} className="font-semibold text-slate-900 hover:text-black">
                  Crear usuario jugador
                </Link>
              </p>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  )
}
