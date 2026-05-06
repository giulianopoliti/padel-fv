'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Building, 
  Users, 
  Trophy,
  Settings,
  BarChart3,
  Star,
  Mail,
  Megaphone
} from 'lucide-react';

const clubFeatures = [
  {
    category: 'Gestión de Torneos',
    icon: Trophy,
    color: 'bg-yellow-100 text-yellow-800',
    features: [
      'Crear y gestionar torneos propios',
      'Establecer categorías y formatos',
      'Control de inscripciones y pagos',
      'Seguimiento de resultados en tiempo real',
      'Generación automática de llaves'
    ]
  },
  {
    category: 'Gestión de Jugadores',
    icon: Users,
    color: 'bg-blue-100 text-blue-800',
    features: [
      'Ver jugadores registrados en el club',
      'Seguimiento de participación',
      'Estadísticas de rendimiento',
      'Comunicación directa con socios',
      'Gestión de membresías'
    ]
  },
  {
    category: 'Perfil del Club',
    icon: Building,
    color: 'bg-purple-100 text-purple-800',
    features: [
      'Galería de fotos del club',
      'Información de contacto completa',
      'Servicios y amenidades',
      'Horarios de funcionamiento',
      'Redes sociales y sitio web'
    ]
  }
];

const managementSteps = [
  {
    step: 1,
    title: 'Configurar Perfil',
    description: 'Completa la información del club, fotos y datos de contacto',
    icon: Settings
  },
  {
    step: 2,
    title: 'Crear Torneos',
    description: 'Organiza competencias para diferentes categorías y niveles',
    icon: Trophy
  },
  {
    step: 3,
    title: 'Gestionar Participantes',
    description: 'Supervisa inscripciones y administra a los jugadores',
    icon: Users
  },
  {
    step: 4,
    title: 'Analizar Resultados',
    description: 'Revisa estadísticas y mejora la experiencia del club',
    icon: BarChart3
  }
];

const benefitsData = [
  {
    title: 'Visibilidad del Club',
    description: 'Aparece en búsquedas de jugadores locales y gana exposición',
    icon: Star,
    color: 'text-yellow-600'
  },
  {
    title: 'Publicidad de Torneos',
    description: 'Promociona tus eventos y atrae más participantes',
    icon: Megaphone,
    color: 'text-blue-600'
  },
  {
    title: 'Comunicación Directa',
    description: 'Canal directo con tu comunidad de jugadores',
    icon: Mail,
    color: 'text-green-600'
  }
];

export default function ClubesInfoPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-emerald-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button 
            variant="ghost" 
            onClick={() => router.push('/info')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Button>
        </div>

        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <div className="bg-purple-100 p-3 rounded-full">
              <Building className="h-8 w-8 text-purple-600" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Gestión de Clubes
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Descubre todas las herramientas disponibles para administrar tu club de pádel de manera profesional
          </p>
        </div>

        {/* Management Steps */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
            Cómo Gestionar tu Club
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {managementSteps.map((step) => {
              const IconComponent = step.icon;
              return (
                <Card key={step.step} className="text-center hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex justify-center mb-3">
                      <div className="bg-purple-100 p-3 rounded-full relative">
                        <IconComponent className="h-6 w-6 text-purple-600" />
                        <div className="absolute -top-2 -right-2 bg-purple-600 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold">
                          {step.step}
                        </div>
                      </div>
                    </div>
                    <CardTitle className="text-lg">{step.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600">
                      {step.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Club Features */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
            Funcionalidades Principales
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {clubFeatures.map((feature) => {
              const IconComponent = feature.icon;
              return (
                <Card key={feature.category} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="bg-white p-2 rounded-full shadow-sm">
                        <IconComponent className="h-6 w-6 text-gray-700" />
                      </div>
                      <Badge className={feature.color}>
                        {feature.category}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {feature.features.map((item, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                          <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mt-2"></div>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Benefits Grid */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
            Beneficios de la Plataforma
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {benefitsData.map((benefit) => {
              const IconComponent = benefit.icon;
              return (
                <Card key={benefit.title} className="text-center hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex justify-center mb-4">
                      <div className="bg-gray-50 p-4 rounded-full">
                        <IconComponent className={`h-12 w-12 ${benefit.color}`} />
                      </div>
                    </div>
                    <CardTitle className="text-xl">{benefit.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600">
                      {benefit.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Tips and Best Practices */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-green-100 p-2 rounded-full">
                  <Settings className="h-5 w-5 text-green-600" />
                </div>
                <CardTitle className="text-xl">Optimización del Perfil</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Fotos de calidad:</h4>
                  <ul className="space-y-1 text-sm text-gray-600">
                    <li>• Incluye fotos de las canchas y instalaciones</li>
                    <li>• Muestra los vestuarios y espacios comunes</li>
                    <li>• Actualiza regularmente la galería</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Información completa:</h4>
                  <ul className="space-y-1 text-sm text-gray-600">
                    <li>• Horarios de atención detallados</li>
                    <li>• Servicios y amenidades disponibles</li>
                    <li>• Datos de contacto actualizados</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-blue-100 p-2 rounded-full">
                  <Trophy className="h-5 w-5 text-blue-600" />
                </div>
                <CardTitle className="text-xl">Organización de Torneos</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Planificación:</h4>
                  <ul className="space-y-1 text-sm text-gray-600">
                    <li>• Define fechas con suficiente anticipación</li>
                    <li>• Considera la capacidad de tus canchas</li>
                    <li>• Establece premios atractivos</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Durante el torneo:</h4>
                  <ul className="space-y-1 text-sm text-gray-600">
                    <li>• Supervisa el desarrollo de los partidos</li>
                    <li>• Mantén comunicación fluida</li>
                    <li>• Documenta el evento con fotos</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Call to Action */}
        <Card className="bg-gradient-to-r from-purple-50 to-indigo-50 border-0">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-indigo-100 p-3 rounded-full">
                <Building className="h-6 w-6 text-indigo-600" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">
              ¿Listo para potenciar tu club?
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600 mb-6">
              Únete a la plataforma y comienza a gestionar tu club de manera profesional
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                className="bg-purple-600 hover:bg-purple-700"
                onClick={() => router.push('/register')}
              >
                Registrar Mi Club
              </Button>
              <Button 
                variant="outline"
                onClick={() => router.push('/clubes')}
              >
                Ver Clubes Registrados
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 