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
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f7f7_0%,#ffffff_45%,#eef3f9_100%)]">
      {children}
      <Toaster />
    </div>
  )
}
