'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { createTournamentAction } from '@/app/api/tournaments/actions';
import { useUser } from '@/contexts/user-context';
import { useUserClubs } from '@/hooks/use-user-clubs';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Trophy,
  Calendar,
  Clock,
  Users,
  FileText,
  Tag,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Loader2,
  Building2,
  Sparkles,
  MapPin,
  Settings,
  Info,
  CalendarDays,
  X,
  Award,
} from 'lucide-react';
import Link from 'next/link';
import { getPresetOptionsByType } from '@/config/tournament-format-presets';
import { buildTournamentFormatConfig } from '@/lib/services/tournament-format-config-builder';
import type { TournamentFormatPresetId } from '@/types/tournament-format-v2';

interface Category {
  name: string;
}

interface Club {
  id: string;
  name: string;
  source: 'owned' | 'organization';
}

const DEFAULT_PRESET_BY_TYPE: Record<'AMERICAN' | 'LONG', TournamentFormatPresetId> = {
  AMERICAN: 'AMERICAN_MULTI_ZONE_2',
  LONG: 'LONG_SINGLE_ZONE_BRACKET',
};

const PRESET_OPTIONS = {
  AMERICAN: getPresetOptionsByType('AMERICAN'),
  LONG: getPresetOptionsByType('LONG'),
} as const;

const tournamentSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  description: z.string().optional(),
  category_name: z.string().min(1, 'Selecciona una categoría'),
  type: z.enum(['LONG', 'AMERICAN'], {
    required_error: 'Selecciona un tipo de torneo',
  }),
  format_preset: z.string().min(1, 'Selecciona un formato'),
  gender: z.enum(['MALE', 'FEMALE', 'MIXED'], {
    required_error: 'Selecciona un género',
  }),
  start_date: z.string().min(1, 'La fecha de inicio es obligatoria'),
  start_time: z.string().optional(), // Optional for LONG tournaments
  end_date: z.string().optional(),
  end_time: z.string().optional(),
  max_participants: z.number().min(2, 'Mínimo 2 parejas').max(64, 'Máximo 64 parejas').optional(),
  club_id: z.string().min(1, 'Selecciona un club'),
  extra_club_ids: z.array(z.string()).default([]),
  price: z.number().int('El precio debe ser un número entero').min(0, 'El precio no puede ser negativo').max(32767, 'El precio es demasiado alto').optional(),
  award: z.string().optional(),
  single_bracket_advance_count: z.number().int().min(2, 'MÃ­nimo 2 parejas').optional(),
  gold_count: z.number().int().min(0, 'No puede ser negativo').optional(),
  silver_count: z.number().int().min(0, 'No puede ser negativo').optional(),
  eliminated_count: z.number().int().min(0, 'No puede ser negativo').optional(),
}).refine((data) => {
  // For AMERICAN tournaments, start_time is required
  if (data.type === 'AMERICAN' && !data.start_time) {
    return false;
  }
  return true;
}, {
  message: 'Para torneos americanos, la hora de inicio es obligatoria',
  path: ['start_time'],
}).refine((data) => {
  // For LONG tournaments, end_date is required
  if (data.type === 'LONG' && !data.end_date) {
    return false;
  }
  return true;
}, {
  message: 'Para torneos largos, la fecha de finalización es obligatoria',
  path: ['end_date'],
}).refine((data) => {
  return !data.extra_club_ids.includes(data.club_id);
}, {
  message: 'El club principal no puede estar en clubes adicionales',
  path: ['extra_club_ids'],
});

type TournamentFormData = z.infer<typeof tournamentSchema>;

export default function TournamentCreateForm() {
  const supabase = createClient();
  const router = useRouter();
  const { user, userDetails, loading: isUserLoading } = useUser();
  const { clubs, isLoading: isClubsLoading, error: clubsError } = useUserClubs();
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [formProgress, setFormProgress] = useState(0);

  const form = useForm<TournamentFormData>({
    resolver: zodResolver(tournamentSchema),
    defaultValues: {
      name: '',
      description: '',
      category_name: '',
      type: 'AMERICAN',
      format_preset: DEFAULT_PRESET_BY_TYPE.AMERICAN,
      gender: 'MALE',
      start_date: '',
      start_time: '',
      end_date: '',
      end_time: '',
      max_participants: undefined,
      club_id: '',
      extra_club_ids: [],
      price: undefined,
      award: '',
      single_bracket_advance_count: 8,
      gold_count: 4,
      silver_count: 4,
      eliminated_count: 0,
    },
  });

  const watchedValues = form.watch();
  const isAmericanTournament = watchedValues.type === 'AMERICAN';
  const selectedType = watchedValues.type;
  const presetOptions = selectedType ? PRESET_OPTIONS[selectedType] : [];
  const selectedPreset = presetOptions.find((preset) => preset.presetId === watchedValues.format_preset);
  const userRole = userDetails?.role;

  // Calcular progreso del formulario
  useEffect(() => {
    const requiredFields = ['name', 'category_name', 'type', 'format_preset', 'gender', 'start_date', 'start_time', 'club_id'];
    const conditionalFields = isAmericanTournament ? [] : ['end_date', 'end_time'];
    const allRequiredFields = [...requiredFields, ...conditionalFields];
    
    const filledFields = allRequiredFields.filter(field => {
      const value = watchedValues[field as keyof TournamentFormData];
      return value !== '' && value !== undefined && value !== null;
    });
    
    const progress = (filledFields.length / allRequiredFields.length) * 100;
    setFormProgress(progress);
  }, [watchedValues, isAmericanTournament]);

  // Cargar categorías
  useEffect(() => {
    async function fetchCategories() {
      if (isUserLoading) return;
      
      if (!user) {
        router.push('/login');
        return;
      }
      
      try {
        setIsLoading(true);
        setError(null);
        
        const { data: categoriesData, error: categoriesError } = await supabase
          .from('categories')
          .select('name')
          .order('name');
          
        if (categoriesError) {
          throw new Error(`Error al cargar categorías: ${categoriesError.message}`);
        }
        
        setCategories(categoriesData || []);
      } catch (err: any) {
        console.error('Error fetching categories:', err);
        setError(err.message || 'Error al cargar categorías');
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchCategories();
  }, [user, isUserLoading, supabase, router]);

  // Resetear fechas de finalización cuando cambia a torneo americano
  useEffect(() => {
    if (isAmericanTournament) {
      form.setValue('end_date', '');
      form.setValue('end_time', '');
    }
  }, [isAmericanTournament, form]);

  useEffect(() => {
    if (!selectedType) return;

    const validPresetIds = PRESET_OPTIONS[selectedType].map((preset) => preset.presetId);
    const currentPresetId = form.getValues('format_preset');

    if (!currentPresetId || !validPresetIds.includes(currentPresetId as TournamentFormatPresetId)) {
      const nextPreset = DEFAULT_PRESET_BY_TYPE[selectedType];
      form.setValue('format_preset', nextPreset);

      const preset = PRESET_OPTIONS[selectedType].find((option) => option.presetId === nextPreset);
      if (preset?.advancementConfig.kind === 'SINGLE') {
        form.setValue('single_bracket_advance_count', preset.advancementConfig.advanceCount);
      }
      if (preset?.advancementConfig.kind === 'GOLD_SILVER') {
        form.setValue('gold_count', preset.advancementConfig.goldCount);
        form.setValue('silver_count', preset.advancementConfig.silverCount);
        form.setValue('eliminated_count', preset.advancementConfig.eliminatedCount);
      }
    }
  }, [selectedType, form]);

  useEffect(() => {
    if (!selectedPreset) return;

    if (selectedPreset.advancementConfig.kind === 'SINGLE') {
      form.setValue('single_bracket_advance_count', selectedPreset.advancementConfig.advanceCount);
    }

    if (selectedPreset.advancementConfig.kind === 'GOLD_SILVER') {
      form.setValue('gold_count', selectedPreset.advancementConfig.goldCount);
      form.setValue('silver_count', selectedPreset.advancementConfig.silverCount);
      form.setValue('eliminated_count', selectedPreset.advancementConfig.eliminatedCount);
    }
  }, [selectedPreset, form]);

  // Auto-asignar club_id cuando el usuario es CLUB
  useEffect(() => {
    if (userRole !== 'ORGANIZADOR' && clubs.length > 0 && !form.getValues('club_id')) {
      form.setValue('club_id', clubs[0].id);
    }
  }, [clubs, userRole, form]);

  // Si cambia el club principal, eliminarlo de extra_club_ids si estaba seleccionado
  useEffect(() => {
    const subscription = form.watch((values, { name }) => {
      if (name === 'club_id') {
        const mainId = values.club_id as string;
        const extras = (values.extra_club_ids as string[]) || [];
        if (mainId && extras.includes(mainId)) {
          form.setValue('extra_club_ids', extras.filter((id) => id !== mainId));
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const extraClubIds = form.watch('extra_club_ids') || [];
  const handleToggleExtraClub = (clubId: string) => {
    const mainId = form.getValues('club_id');
    if (!clubId || clubId === mainId) return;
    const set = new Set<string>(extraClubIds);
    if (set.has(clubId)) {
      set.delete(clubId);
    } else {
      set.add(clubId);
    }
    form.setValue('extra_club_ids', Array.from(set));
  };

  const onSubmit = async (data: TournamentFormData) => {
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      // ✅ FIXED: Simple UTC conversion without manual timezone adjustments
      const formatDateTime = (date: string, time?: string) => {
        if (!date) return null;
        
        // For LONG tournaments without time, use start of day in Argentina timezone
        if (!time) {
          // Create date at noon to avoid timezone issues with date-only values
          const dateObj = new Date(`${date}T12:00:00`);
          return dateObj.toISOString();
        }
        
        // For AMERICAN tournaments with time, create proper timestamp
        const fullTime = time.length === 5 ? `${time}:00` : time;
        const localDate = new Date(`${date}T${fullTime}`);
        
        // Simply convert to ISO string - the browser will handle the local timezone
        // and toISOString() will give us proper UTC
        return localDate.toISOString();
      };

      const dataForAction = {
        name: data.name.trim(),
        description: data.description?.trim() || null,
        category_name: data.category_name,
        type: data.type as 'LONG' | 'AMERICAN',
        format_config: buildTournamentFormatConfig({
          presetId: data.format_preset as TournamentFormatPresetId,
          singleAdvanceCount: data.single_bracket_advance_count,
          goldCount: data.gold_count,
          silverCount: data.silver_count,
          eliminatedCount: data.eliminated_count,
        }),
        gender: data.gender as 'MALE' | 'FEMALE' | 'MIXED',
        start_date: formatDateTime(data.start_date, data.start_time),
        end_date: data.type === 'LONG' && data.end_date ? formatDateTime(data.end_date) : null,
        max_participants: data.max_participants || null,
        club_id: data.club_id,
        extra_club_ids: (data.extra_club_ids || []).filter((id) => id && id !== data.club_id),
        price: data.price ?? null,
        award: data.award?.trim() || null,
      };

      const result = await createTournamentAction(dataForAction);
      
      if (result.success && result.tournament?.id) {
        setSuccessMessage('¡Torneo creado exitosamente! Redirigiendo...');
        
        router.refresh();
        setTimeout(() => {
          window.location.href = `/tournaments/${result.tournament.id}`;
        }, 2000);
      } else {
        throw new Error(result.error || 'Error desconocido al crear el torneo');
      }
    } catch (err: any) {
      setError(err.message || 'Error al crear el torneo');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || isUserLoading || isClubsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="relative">
            <Loader2 className="h-12 w-12 animate-spin text-slate-900 mx-auto" />
            <div className="absolute inset-0 h-12 w-12 rounded-full border-2 border-slate-200 animate-pulse mx-auto" />
          </div>
          <div className="space-y-2">
            <p className="text-lg font-medium text-slate-900">Preparando formulario...</p>
            <p className="text-sm text-slate-500">Cargando categorías y configuración</p>
          </div>
        </div>
      </div>
    );
  }

  const selectedClub = clubs.find(club => club.id === watchedValues.club_id);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Header Elegante */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200/50 sticky top-0 z-10 shadow-sm transition-all duration-300 animate-in slide-in-from-top-4">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <Button asChild variant="ghost" size="sm" className="text-slate-600 hover:text-slate-900 transition-colors duration-200 hover:scale-105">
              <Link href="/tournaments">
                <ArrowLeft className="h-4 w-4 mr-2 transition-transform duration-200 group-hover:-translate-x-1" />
                Volver
              </Link>
            </Button>
            
            <div className="text-center space-y-1 animate-in fade-in-0 duration-500">
              <div className="flex items-center justify-center gap-2">
                <Sparkles className="h-6 w-6 text-slate-900 animate-pulse" />
                <h1 className="text-3xl font-light text-slate-900">Crear Torneo</h1>
              </div>
              <p className="text-slate-500 font-light">Configura tu torneo con elegancia y precisión</p>
            </div>
            
            <div className="flex items-center gap-2">
              <Trophy className="h-7 w-7 text-slate-900 transition-transform duration-300 hover:rotate-12" />
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-6 space-y-2 animate-in slide-in-from-bottom-2 duration-700">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Progreso del formulario</span>
              <span className="text-slate-700 font-medium transition-all duration-300">{Math.round(formProgress)}%</span>
            </div>
            <Progress value={formProgress} className="h-1.5 transition-all duration-500" />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Alerts */}
          {error && (
            <Alert className="mb-6 border-red-200/50 bg-red-50/50 backdrop-blur-sm animate-in slide-in-from-top-2 fade-in-0 duration-400">
              <AlertCircle className="h-4 w-4 text-red-600 animate-pulse" />
              <AlertDescription className="text-red-700">{error}</AlertDescription>
            </Alert>
          )}

          {clubsError && (
            <Alert className="mb-6 border-red-200/50 bg-red-50/50 backdrop-blur-sm animate-in slide-in-from-top-2 fade-in-0 duration-400">
              <AlertCircle className="h-4 w-4 text-red-600 animate-pulse" />
              <AlertDescription className="text-red-700">{clubsError}</AlertDescription>
            </Alert>
          )}

          {successMessage && (
            <Alert className="mb-6 border-emerald-200/50 bg-emerald-50/50 backdrop-blur-sm animate-in slide-in-from-top-2 fade-in-0 duration-400">
              <CheckCircle className="h-4 w-4 text-emerald-600 animate-bounce" />
              <AlertDescription className="text-emerald-700">{successMessage}</AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              {/* Información Básica */}
              <Card className="border-slate-200/50 shadow-sm bg-white/50 backdrop-blur-sm transition-all duration-300 hover:shadow-md hover:bg-white/70 animate-in slide-in-from-bottom-4 fade-in-0 duration-600">
                <CardHeader className="border-b border-slate-100/50 bg-slate-50/30 transition-colors duration-300 hover:bg-slate-50/50">
                  <CardTitle className="flex items-center text-xl font-light text-slate-900 transition-colors duration-200">
                    <FileText className="h-5 w-5 mr-3 text-slate-700 transition-transform duration-200 group-hover:scale-110" />
                    Información Básica
                  </CardTitle>
                  <CardDescription className="text-slate-500 transition-colors duration-200 hover:text-slate-600">
                    Dale nombre y personalidad a tu torneo
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 p-8">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 font-medium">
                          Nombre del Torneo
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ej: Torneo Primavera 2024"
                            className="border-slate-200/50 focus:border-slate-900 focus:ring-slate-900 bg-white/70 transition-all duration-300 focus:scale-[1.02] hover:bg-white/90 focus:shadow-sm"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 font-medium">
                          Descripción
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe tu torneo, premios, reglas especiales..."
                            className="border-slate-200/50 focus:border-slate-900 focus:ring-slate-900 bg-white/70 resize-none transition-colors min-h-[100px]"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription className="text-slate-500">
                          Opcional - Ayuda a los jugadores a entender mejor tu torneo
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Configuración del Torneo */}
              <Card className="border-slate-200/50 shadow-sm bg-white/50 backdrop-blur-sm transition-all duration-300 hover:shadow-md hover:bg-white/70 animate-in slide-in-from-bottom-4 fade-in-0 duration-700">
                <CardHeader className="border-b border-slate-100/50 bg-slate-50/30 transition-colors duration-300 hover:bg-slate-50/50">
                  <CardTitle className="flex items-center text-xl font-light text-slate-900 transition-colors duration-200">
                    <Settings className="h-5 w-5 mr-3 text-slate-700 transition-transform duration-200 group-hover:rotate-45" />
                    Configuración del Torneo
                  </CardTitle>
                  <CardDescription className="text-slate-500 transition-colors duration-200 hover:text-slate-600">
                    Define las características técnicas de la competencia
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8 p-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <FormField
                      control={form.control}
                      name="category_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 font-medium">
                            Categoría
                          </FormLabel>
                          <FormControl>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <SelectTrigger className="border-slate-200/50 focus:border-slate-900 focus:ring-slate-900 bg-white/70">
                                <SelectValue placeholder="Selecciona una categoría" />
                              </SelectTrigger>
                              <SelectContent>
                                {categories.map(cat => (
                                  <SelectItem key={cat.name} value={cat.name}>
                                    <div className="flex items-center gap-2">
                                      <Tag className="h-3 w-3" />
                                      {cat.name}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Club Selector */}
                    <FormField
                      control={form.control}
                      name="club_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 font-medium">
                            <Building2 className="h-4 w-4 inline mr-1" />
                            {userRole === 'ORGANIZADOR' ? 'Club' : 'Tu Club'}
                          </FormLabel>
                          <FormControl>
                            {userRole === 'ORGANIZADOR' ? (
                              <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting}>
                                <SelectTrigger className="border-slate-200/50 focus:border-slate-900 focus:ring-slate-900 bg-white/70">
                                  <SelectValue placeholder="Selecciona un club" />
                                </SelectTrigger>
                                <SelectContent>
                                  {clubs.map(club => (
                                    <SelectItem key={club.id} value={club.id}>
                                      <div className="flex items-center gap-2">
                                        <Building2 className="h-4 w-4" />
                                        <span>{club.name}</span>
                                        <Badge variant="secondary" className="text-xs">
                                          {club.source === 'owned' ? 'Propio' : 'Organización'}
                                        </Badge>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <div className="relative">
                                <Input
                                  value={clubs[0]?.name || ''}
                                  disabled
                                  className="border-slate-200/50 bg-slate-50/70 pr-10"
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                  <Badge variant="outline" className="text-xs">
                                    Tu club
                                  </Badge>
                                </div>
                              </div>
                            )}
                          </FormControl>
                          {userRole === 'ORGANIZADOR' && clubs.length === 0 && (
                            <FormDescription className="text-amber-600">
                              No tienes clubes asociados a tu organización
                            </FormDescription>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {userRole === 'ORGANIZADOR' && clubs.length > 0 && (
                      <FormField
                        control={form.control}
                        name="extra_club_ids"
                        render={() => (
                          <FormItem>
                            <FormLabel className="text-slate-700 font-medium">
                              <Building2 className="h-4 w-4 inline mr-1" />
                              Clubes adicionales
                            </FormLabel>
                            <FormControl>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button
                                    type="button"
                                    role="combobox"
                                    aria-expanded="false"
                                    aria-label="Seleccionar clubes adicionales"
                                    className="w-full justify-between inline-flex items-center h-10 rounded-md border border-slate-200/50 bg-white/70 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    tabIndex={0}
                                  >
                                    <span className="text-left text-slate-700">
                                      {extraClubIds.length === 0 ? 'Selecciona clubes adicionales' : `${extraClubIds.length} seleccionado${extraClubIds.length > 1 ? 's' : ''}`}
                                    </span>
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                  <Command>
                                    <CommandInput placeholder="Buscar club..." className="h-9" />
                                    <CommandList>
                                      <CommandEmpty>No se encontraron clubes</CommandEmpty>
                                      <CommandGroup>
                                        {clubs.map((club) => (
                                          <CommandItem
                                            key={club.id}
                                            value={club.name}
                                            onSelect={() => handleToggleExtraClub(club.id)}
                                            className="flex items-center gap-2"
                                          >
                                            <Checkbox
                                              checked={extraClubIds.includes(club.id)}
                                              onCheckedChange={() => handleToggleExtraClub(club.id)}
                                              aria-label={`Seleccionar ${club.name}`}
                                            />
                                            <Building2 className="h-4 w-4 text-slate-700" />
                                            <span className="flex-1 text-slate-700">{club.name}</span>
                                            <Badge variant="secondary" className="text-xs">
                                              {club.source === 'owned' ? 'Propio' : 'Organización'}
                                            </Badge>
                                          </CommandItem>
                                        ))}
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                            </FormControl>
                            {extraClubIds.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {extraClubIds.map((id) => {
                                  const c = clubs.find((cl) => cl.id === id);
                                  if (!c) return null;
                                  return (
                                    <Badge key={id} variant="outline" className="px-2 py-1 text-xs bg-white/70 border-slate-200/70">
                                      <span className="mr-2 text-slate-700">{c.name}</span>
                                      <button
                                        type="button"
                                        aria-label={`Quitar ${c.name}`}
                                        onClick={() => handleToggleExtraClub(id)}
                                        className="inline-flex items-center justify-center rounded-sm hover:bg-slate-100 text-slate-600"
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </button>
                                    </Badge>
                                  );
                                })}
                              </div>
                            )}
                            <FormDescription className="text-slate-500">
                              Opcional - Selecciona otros clubes relacionados a tu torneo.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="format_preset"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 font-medium">
                            Formato competitivo
                          </FormLabel>
                          <FormControl>
                            <Select onValueChange={field.onChange} value={field.value || ''} disabled={!selectedType}>
                              <SelectTrigger className="border-slate-200/50 focus:border-slate-900 focus:ring-slate-900 bg-white/70">
                                <SelectValue placeholder="Selecciona un formato" />
                              </SelectTrigger>
                              <SelectContent>
                                {presetOptions.map((preset) => (
                                  <SelectItem key={preset.presetId} value={preset.presetId}>
                                    <div className="space-y-1">
                                      <div className="font-medium">{preset.display.name}</div>
                                      <div className="text-xs text-slate-500">{preset.display.description}</div>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormDescription className="text-slate-500">
                            Elige si el torneo va por zonas, zona unica, campeon directo o copas.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {selectedPreset?.advancementConfig.kind === 'SINGLE' ? (
                      <FormField
                        control={form.control}
                        name="single_bracket_advance_count"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-700 font-medium">
                              Parejas que avanzan a la llave
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="2"
                                className="border-slate-200/50 focus:border-slate-900 focus:ring-slate-900 bg-white/70"
                                value={field.value ?? ''}
                                onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                              />
                            </FormControl>
                            <FormDescription className="text-slate-500">
                              Puedes usarlo para dejar afuera parejas antes de la llave.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : selectedPreset?.advancementConfig.kind === 'GOLD_SILVER' ? (
                      <div className="grid grid-cols-3 gap-3 md:col-span-1">
                        <FormField
                          control={form.control}
                          name="gold_count"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-slate-700 font-medium">Oro</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="0"
                                  className="border-slate-200/50 focus:border-slate-900 focus:ring-slate-900 bg-white/70"
                                  value={field.value ?? ''}
                                  onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="silver_count"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-slate-700 font-medium">Plata</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="0"
                                  className="border-slate-200/50 focus:border-slate-900 focus:ring-slate-900 bg-white/70"
                                  value={field.value ?? ''}
                                  onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="eliminated_count"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-slate-700 font-medium">Afuera</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="0"
                                  className="border-slate-200/50 focus:border-slate-900 focus:ring-slate-900 bg-white/70"
                                  value={field.value ?? ''}
                                  onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    ) : (
                      <div className="rounded-xl border border-slate-200/70 bg-slate-50/70 px-4 py-3 text-sm text-slate-600">
                        {selectedPreset?.display.description || 'Selecciona un formato para ver su configuracion.'}
                      </div>
                    )}
                  </div>

                  {selectedPreset && (
                    <div className="rounded-xl border border-slate-200/70 bg-slate-50/70 p-4">
                      <p className="text-sm font-medium text-slate-900">{selectedPreset.display.name}</p>
                      <p className="mt-1 text-sm text-slate-600">{selectedPreset.display.description}</p>
                    </div>
                  )}

                  <Separator className="bg-slate-100/50" />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 font-medium">
                            Tipo de Torneo
                          </FormLabel>
                          <FormControl>
                            <Select onValueChange={field.onChange} value={field.value || ''}>
                              <SelectTrigger className="border-slate-200/50 focus:border-slate-900 focus:ring-slate-900 bg-white/70">
                                <SelectValue placeholder="Selecciona tipo" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="LONG">
                                  <div className="space-y-1">
                                    <div className="font-medium">Largo</div>
                                    <div className="text-xs text-slate-500">Tradicional - Múltiples días</div>
                                  </div>
                                </SelectItem>
                                <SelectItem value="AMERICAN">
                                  <div className="space-y-1">
                                    <div className="font-medium">Americano</div>
                                    <div className="text-xs text-slate-500">Un solo día</div>
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="gender"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 font-medium">
                            Género
                          </FormLabel>
                          <FormControl>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <SelectTrigger className="border-slate-200/50 focus:border-slate-900 focus:ring-slate-900 bg-white/70">
                                <SelectValue placeholder="Selecciona género" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="MALE">Masculino</SelectItem>
                                <SelectItem value="FEMALE">Femenino</SelectItem>
                                <SelectItem value="MIXED">Mixto</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="max_participants"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 font-medium">
                            <Users className="h-4 w-4 inline mr-1" />
                            Máximo de Parejas
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="2"
                              max="64"
                              placeholder="Ej: 16"
                              className="border-slate-200/50 focus:border-slate-900 focus:ring-slate-900 bg-white/70"
                              value={field.value || ''}
                              onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                            />
                          </FormControl>
                          <FormDescription className="text-slate-500">
                            Opcional - Limita las inscripciones
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Separator className="bg-slate-100/50" />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 font-medium">
                            <Tag className="h-4 w-4 inline mr-1" />
                            Precio de Inscripción
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              max="32767"
                              step="1"
                              placeholder="Ej: 500"
                              className="border-slate-200/50 focus:border-slate-900 focus:ring-slate-900 bg-white/70"
                              value={field.value ?? ''}
                              onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                            />
                          </FormControl>
                          <FormDescription className="text-slate-500">
                            Opcional - Costo de participación en pesos (solo números)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="award"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 font-medium">
                            <Award className="h-4 w-4 inline mr-1" />
                            Premio
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="text"
                              placeholder="Ej: $1000 o Trofeo"
                              className="border-slate-200/50 focus:border-slate-900 focus:ring-slate-900 bg-white/70"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription className="text-slate-500">
                            Opcional - Premio para los ganadores
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {isAmericanTournament && (
                    <div className="bg-blue-50/50 border border-blue-200/50 rounded-xl p-6 backdrop-blur-sm">
                      <div className="flex items-start space-x-3">
                        <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-blue-900">Torneo Americano</p>
                          <p className="text-sm text-blue-700 leading-relaxed">
                            Los torneos americanos se desarrollan en un solo día. No necesitas especificar fecha de finalización.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Fechas y Horarios */}
              <Card className="border-slate-200/50 shadow-sm bg-white/50 backdrop-blur-sm transition-all duration-300 hover:shadow-md hover:bg-white/70 animate-in slide-in-from-bottom-4 fade-in-0 duration-800">
                <CardHeader className="border-b border-slate-100/50 bg-slate-50/30 transition-colors duration-300 hover:bg-slate-50/50">
                  <CardTitle className="flex items-center text-xl font-light text-slate-900 transition-colors duration-200">
                    <CalendarDays className="h-5 w-5 mr-3 text-slate-700 transition-transform duration-200 group-hover:scale-110" />
                    Fechas y Horarios
                  </CardTitle>
                  <CardDescription className="text-slate-500 transition-colors duration-200 hover:text-slate-600">
                    Programa cuándo se llevará a cabo tu torneo
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8 p-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <FormField
                      control={form.control}
                      name="start_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 font-medium">
                            <Calendar className="h-4 w-4 inline mr-1" />
                            Fecha de Inicio
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              min={new Date().toISOString().split('T')[0]}
                              className="border-slate-200/50 focus:border-slate-900 focus:ring-slate-900 bg-white/70"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {isAmericanTournament && (
                      <FormField
                        control={form.control}
                        name="start_time"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-700 font-medium">
                              <Clock className="h-4 w-4 inline mr-1" />
                              Hora de Inicio
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="time"
                                className="border-slate-200/50 focus:border-slate-900 focus:ring-slate-900 bg-white/70"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription className="text-slate-500">
                              Requerido para torneos americanos
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>

                  {!isAmericanTournament && (
                    <>
                      <Separator className="bg-slate-100/50" />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <FormField
                          control={form.control}
                          name="end_date"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-slate-700 font-medium">
                                <Calendar className="h-4 w-4 inline mr-1" />
                                Fecha de Finalización
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="date"
                                  min={watchedValues.start_date || new Date().toISOString().split('T')[0]}
                                  className="border-slate-200/50 focus:border-slate-900 focus:ring-slate-900 bg-white/70"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="end_time"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-slate-700 font-medium">
                                <Clock className="h-4 w-4 inline mr-1" />
                                Hora de Finalización
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="time"
                                  className="border-slate-200/50 focus:border-slate-900 focus:ring-slate-900 bg-white/70"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Botones de Acción */}
              <div className="flex justify-between items-center pt-6 animate-in slide-in-from-bottom-2 fade-in-0 duration-900">
                <Button asChild variant="outline" size="lg" className="px-8 transition-all duration-200 hover:scale-105 hover:shadow-sm">
                  <Link href="/tournaments">
                    <ArrowLeft className="h-4 w-4 mr-2 transition-transform duration-200 group-hover:-translate-x-1" />
                    Cancelar
                  </Link>
                </Button>
                
                <div className="flex items-center gap-4">
                  {selectedClub && (
                    <div className="text-right animate-in slide-in-from-right-2 fade-in-0 duration-600">
                      <p className="text-sm text-slate-500">Creando en:</p>
                      <p className="font-medium text-slate-700 transition-colors duration-200 hover:text-slate-900">{selectedClub.name}</p>
                    </div>
                  )}
                  
                  <Button
                    type="submit"
                    size="lg"
                    className="bg-slate-900 hover:bg-slate-800 text-white px-8 transition-all duration-300 hover:scale-105 hover:shadow-lg shadow-sm disabled:hover:scale-100"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creando Torneo...
                      </>
                    ) : (
                      <>
                        <Trophy className="h-4 w-4 mr-2 transition-transform duration-200 group-hover:rotate-12" />
                        Crear Torneo
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
