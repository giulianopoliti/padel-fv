import { Toaster } from "@/components/ui/toaster"

export const metadata = {
  title: "Login",
  description: "Iniciar sesion en el tenant de padel",
}

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      {children}
      <Toaster />
    </div>
  )
}
