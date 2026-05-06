import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function CoachDashboard() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold text-padel-green-700 mb-6">Dashboard de Entrenador</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Mis Alumnos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">No tienes alumnos registrados actualmente.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mis Clases</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">No tienes clases programadas actualmente.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
