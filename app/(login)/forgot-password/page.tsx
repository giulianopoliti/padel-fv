"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import Link from "next/link"
import { ArrowLeft, Mail, CheckCircle } from "lucide-react"
import CPALogo from "@/components/ui/cpa-logo"
import { createClient } from "@/utils/supabase/client"

export default function ForgotPasswordPage() {
  const { toast } = useToast()
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isEmailSent, setIsEmailSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    if (!email) {
      setError("Por favor, ingresa tu email.")
      setIsSubmitting(false)
      return
    }

    try {
      const supabase = createClient()
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?type=recovery&next=/reset-password`,
      })

      if (error) {
        console.error("Error sending reset email:", error)
        setError("Error al enviar el email. Verifica que la dirección sea correcta.")
        toast({
          title: "Error",
          description: "No se pudo enviar el email de recuperación.",
          variant: "destructive",
        })
      } else {
        setIsEmailSent(true)
        toast({
          title: "Email enviado",
          description: "Revisa tu bandeja de entrada para restablecer tu contraseña.",
        })
      }
    } catch (err) {
      console.error("Unexpected error:", err)
      setError("Error inesperado. Inténtalo de nuevo.")
      toast({
        title: "Error",
        description: "Error inesperado. Inténtalo de nuevo.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isEmailSent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-lg border-0">
          <CardHeader className="space-y-1 pb-6">
            <div className="flex justify-center mb-4">
              <CPALogo />
            </div>
            <div className="flex justify-center mb-4">
              <div className="bg-green-100 p-3 rounded-full">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-center text-slate-800">
              Email Enviado
            </CardTitle>
            <CardDescription className="text-center text-slate-600">
              Te hemos enviado un link para restablecer tu contraseña
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4 text-center">
            <div className="space-y-2">
              <p className="text-sm text-slate-600">
                Revisa tu bandeja de entrada en:
              </p>
              <p className="font-semibold text-slate-800 bg-slate-50 px-3 py-2 rounded-lg">
                {email}
              </p>
            </div>
            
            <div className="space-y-2 text-sm text-slate-500">
              <p>• El link expira en 60 minutos</p>
              <p>• Revisa también tu carpeta de spam</p>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-3">
            <Button
              variant="outline"
              onClick={() => {
                setIsEmailSent(false)
                setEmail("")
              }}
              className="w-full"
            >
              Enviar a otro email
            </Button>
            
            <Link 
              href="/login" 
              className="flex items-center justify-center gap-2 text-slate-600 hover:text-slate-800 text-sm font-medium"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver al inicio de sesión
            </Link>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg border-0">
        <CardHeader className="space-y-1 pb-6">
          <div className="flex justify-center mb-4">
            <CPALogo />
          </div>
          <div className="flex justify-center mb-4">
            <div className="bg-blue-100 p-3 rounded-full">
              <Mail className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-center text-slate-800">
            ¿Olvidaste tu contraseña?
          </CardTitle>
          <CardDescription className="text-center text-slate-600">
            Ingresa tu email y te enviaremos un link para restablecer tu contraseña
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                className="h-11"
                autoComplete="email"
                required
              />
            </div>
            
            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                {error}
              </div>
            )}
          </CardContent>

          <CardFooter className="flex flex-col space-y-3">
            <Button 
              type="submit" 
              className="w-full h-11 bg-blue-600 hover:bg-blue-700"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Enviando..." : "Enviar link de recuperación"}
            </Button>
            
            <Link 
              href="/login" 
              className="flex items-center justify-center gap-2 text-slate-600 hover:text-slate-800 text-sm font-medium"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver al inicio de sesión
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
} 