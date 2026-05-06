"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { toast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import { create } from "domain"

// Definir el esquema de validación para el perfil
const profileFormSchema = z.object({
  email: z.string().email({
    message: "Por favor, introduce un email válido.",
  }),
  avatar_url: z.string().optional(),
})

type ProfileFormValues = z.infer<typeof profileFormSchema>

// Definir la interfaz para las props
interface UserProfileFormProps {
  user: {
    id: string
    email: string | null
    role: string | null
    avatar_url?: string | null
  }
}

export default function UserProfileForm({ user }: UserProfileFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  // Valores por defecto para el formulario
  const defaultValues: Partial<ProfileFormValues> = {
    email: user.email || "",
    avatar_url: user.avatar_url || "",
  }

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues,
    mode: "onChange",
  })

  async function onSubmit(data: ProfileFormValues) {
    setIsLoading(true)

    try {
      const supabase = await createClient()
      // Ejecutar una SQL directa para actualizar el avatar_url
      const { error } = await supabase.from('users').upsert({
        id: user.id,
        avatar_url: data.avatar_url || null
      }, {
        onConflict: 'id',
        ignoreDuplicates: false
      })

      if (error) {
        throw new Error(error.message)
      }

      toast({
        title: "Perfil actualizado",
        description: "Tu perfil se ha actualizado correctamente.",
      })

      // Refrescar la página para mostrar los cambios
      router.refresh()
    } catch (error) {
      console.error("Error updating profile:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Ha ocurrido un error al actualizar tu perfil.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="tu@email.com" {...field} disabled={isLoading} />
              </FormControl>
              <FormDescription>
                Este es el email con el que te registraste.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="avatar_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>URL del Avatar</FormLabel>
              <FormControl>
                <Input placeholder="https://ejemplo.com/tu-avatar.jpg" {...field} disabled={isLoading} />
              </FormControl>
              <FormDescription>
                URL de la imagen que quieres usar como avatar.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Guardando..." : "Guardar Cambios"}
        </Button>
      </form>
    </Form>
  )
} 