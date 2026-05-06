import { getUserRole } from "@/app/api/users";
import { redirect } from "next/navigation";
import TournamentCreateForm from "@/components/tournaments/tournament-create-form";
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, ArrowLeft, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200/50 sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Button asChild variant="ghost" size="sm">
              <Link href="/tournaments">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver a Torneos
              </Link>
            </Button>
            <div className="text-center">
              <h1 className="text-2xl font-light text-slate-900">Acceso Restringido</h1>
            </div>
            <Shield className="h-8 w-8 text-red-500" />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        <div className="max-w-2xl mx-auto">
          <Card className="border-slate-200/50 shadow-sm bg-white/50 backdrop-blur-sm">
            <CardHeader className="text-center border-b border-slate-100/50">
              <div className="mx-auto mb-4 w-12 h-12 bg-red-50 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-500" />
              </div>
              <CardTitle className="text-xl font-light text-red-700">
                No tienes permisos para crear torneos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 text-center p-8">
              <Alert className="border-amber-200/50 bg-amber-50/50 backdrop-blur-sm">
                <Shield className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800">
                  Solo los <strong>clubes</strong> y <strong>organizadores</strong> pueden crear torneos en la plataforma.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <p className="text-slate-600 font-light">
                  Para crear torneos necesitas tener uno de los siguientes roles:
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border border-blue-200/50 rounded-lg bg-blue-50/50 backdrop-blur-sm">
                    <h3 className="font-medium text-blue-900 mb-2">Club</h3>
                    <p className="text-sm text-blue-700 leading-relaxed">
                      Si tienes un club de padel, puedes registrarte como club para crear torneos en tus instalaciones.
                    </p>
                  </div>
                  
                  <div className="p-4 border border-emerald-200/50 rounded-lg bg-emerald-50/50 backdrop-blur-sm">
                    <h3 className="font-medium text-emerald-900 mb-2">Organizador</h3>
                    <p className="text-sm text-emerald-700 leading-relaxed">
                      Los organizadores pueden crear torneos en múltiples clubes asociados a su organización.
                    </p>
                  </div>
                </div>

                <p className="text-sm text-slate-500 mt-6 font-light">
                  Si crees que deberías tener acceso, contacta con el administrador del sistema.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
                <Button asChild variant="outline" size="lg" className="font-light">
                  <Link href="/tournaments">
                    Ver Torneos Disponibles
                  </Link>
                </Button>
                
                <Button asChild size="lg" className="bg-slate-900 hover:bg-slate-800 font-light">
                  <Link href="/edit-profile">
                    Ir a Mi Perfil
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default async function CreateTournamentPage() {
  try {
    const userRole = await getUserRole();

    console.log('[CreateTournamentPage] User role:', userRole);

    if (userRole === "CLUB" || userRole === "ORGANIZADOR") {
      console.log('[CreateTournamentPage] Authorized user, showing form');
      return <TournamentCreateForm />;
    } else {
      console.log('[CreateTournamentPage] Unauthorized user, showing error page');
      return <UnauthorizedPage />;
    }
  } catch (error) {
    // If getUserRole fails (auth issues), redirect to login
    console.error("[CreateTournamentPage] Error getting user role:", error);
    redirect("/login");
  }
}