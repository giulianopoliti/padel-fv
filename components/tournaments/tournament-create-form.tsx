'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check, CheckCircle, AlertCircle, Loader2, ArrowLeft, ArrowRight, Trophy, FileText, Settings, CalendarDays, Users, Tag, Award, Building2, Sparkles, Info, Clock, Calendar, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { createTournamentAction } from '@/app/api/tournaments/actions';
import { useUser } from '@/contexts/user-context';
import { getPresetOptionsByType } from '@/config/tournament-format-presets';
import { useUserClubs } from '@/hooks/use-user-clubs';
import { buildTournamentFormatConfig } from '@/lib/services/tournament-format-config-builder';
import { cn } from '@/lib/utils';
import type { TournamentFormatPresetId } from '@/types/tournament-format-v2';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';

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

const STEP_TITLES = [
  {
    id: 1,
    title: 'Base',
    description: 'Identidad y formato',
    icon: FileText,
  },
  {
    id: 2,
    title: 'Agenda',
    description: 'Fechas del torneo',
    icon: CalendarDays,
  },
  {
    id: 3,
    title: 'Cierre',
    description: 'Cupo y revisión final',
    icon: Trophy,
  },
] as const;

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
  start_time: z.string().optional(),
  end_date: z.string().optional(),
  end_time: z.string().optional(),
  max_participants: z.number().min(2, 'Mínimo 2 parejas').max(64, 'Máximo 64 parejas').optional(),
  club_id: z.string().min(1, 'Selecciona un club'),
  extra_club_ids: z.array(z.string()).default([]),
  price: z.number().int('El precio debe ser un número entero').min(0, 'El precio no puede ser negativo').max(32767, 'El precio es demasiado alto').optional(),
  award: z.string().optional(),
  single_bracket_advance_count: z.number().int().min(2, 'Mínimo 2 parejas').optional(),
  gold_count: z.number().int().min(0, 'No puede ser negativo').optional(),
  silver_count: z.number().int().min(0, 'No puede ser negativo').optional(),
  eliminated_count: z.number().int().min(0, 'No puede ser negativo').optional(),
}).refine((data) => {
  if (data.type === 'AMERICAN' && !data.start_time) {
    return false;
  }
  return true;
}, {
  message: 'Para torneos americanos, la hora de inicio es obligatoria',
  path: ['start_time'],
}).refine((data) => {
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

const TYPE_COPY = {
  AMERICAN: {
    title: 'Americano',
    description: 'Pensado para resolverse en un solo día, con horarios más definidos.',
    badge: '1 día',
  },
  LONG: {
    title: 'Long',
    description: 'Ideal para una competencia distribuida en varios días con cierre estimado.',
    badge: 'Varios días',
  },
} as const;

const formatInputDate = (date: string) => {
  if (!date) return 'Sin definir';
  const parsed = new Date(`${date}T12:00:00`);
  return parsed.toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

const formatCurrency = (value?: number) => {
  if (value === undefined || value === null) return 'Sin definir';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value);
};

const getPresetMeta = (presetId: string) => {
  const preset = [...PRESET_OPTIONS.AMERICAN, ...PRESET_OPTIONS.LONG].find((option) => option.presetId === presetId);
  if (!preset) return [];

  const zoneLabel = preset.zoneMode === 'MULTI_ZONE' ? 'Múltiples zonas' : 'Zona única';
  const stageLabel = preset.zoneStage === 'ROUND_ROBIN' ? 'Todos contra todos' : `${preset.targetMatchesPerCouple ?? 0} partidos por pareja`;
  const bracketLabel = preset.bracketMode === 'SINGLE'
    ? 'Llave única'
    : preset.bracketMode === 'GOLD_SILVER'
      ? 'Copa Oro y Plata'
      : 'Campeón directo';

  return [zoneLabel, stageLabel, bracketLabel];
};

export default function TournamentCreateForm() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { user, userDetails, loading: isUserLoading } = useUser();
  const { clubs, isLoading: isClubsLoading, error: clubsError, defaultClubId } = useUserClubs();

  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);

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
  const selectedType = watchedValues.type;
  const isAmericanTournament = selectedType === 'AMERICAN';
  const presetOptions = PRESET_OPTIONS[selectedType];
  const selectedPreset = presetOptions.find((preset) => preset.presetId === watchedValues.format_preset);
  const extraClubIds = form.watch('extra_club_ids') || [];
  const userRole = userDetails?.role;
  const selectedClub = clubs.find((club) => club.id === watchedValues.club_id);
  const selectedExtraClubs = clubs.filter((club) => extraClubIds.includes(club.id));
  const progressValue = (currentStep / STEP_TITLES.length) * 100;

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

  useEffect(() => {
    if (selectedType === 'AMERICAN') {
      form.setValue('end_date', '');
      form.setValue('end_time', '');
    } else {
      form.setValue('start_time', '');
      form.setValue('end_time', '');
    }
  }, [selectedType, form]);

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

  useEffect(() => {
    if (userRole !== 'ORGANIZADOR' && defaultClubId && !form.getValues('club_id')) {
      form.setValue('club_id', defaultClubId);
    }
  }, [defaultClubId, userRole, form]);

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

  const handleToggleExtraClub = (clubId: string) => {
    const mainId = form.getValues('club_id');
    if (!clubId || clubId === mainId) return;

    const next = new Set<string>(extraClubIds);
    if (next.has(clubId)) {
      next.delete(clubId);
    } else {
      next.add(clubId);
    }

    form.setValue('extra_club_ids', Array.from(next), { shouldValidate: true });
  };

  const getStepFields = () => {
    if (currentStep === 1) {
      const baseFields: (keyof TournamentFormData)[] = ['name', 'category_name', 'type', 'format_preset', 'gender', 'club_id'];

      if (selectedPreset?.advancementConfig.kind === 'SINGLE') {
        baseFields.push('single_bracket_advance_count');
      }

      if (selectedPreset?.advancementConfig.kind === 'GOLD_SILVER') {
        baseFields.push('gold_count', 'silver_count', 'eliminated_count');
      }

      return baseFields;
    }

    if (currentStep === 2) {
      return isAmericanTournament
        ? ['start_date', 'start_time']
        : ['start_date', 'end_date'];
    }

    return [];
  };

  const handleNextStep = async () => {
    const fields = getStepFields();
    const isValid = fields.length === 0 ? true : await form.trigger(fields);

    if (!isValid) return;
    setCurrentStep((previous) => Math.min(previous + 1, STEP_TITLES.length));
  };

  const handlePreviousStep = () => {
    setCurrentStep((previous) => Math.max(previous - 1, 1));
  };

  const handleCreateTournament = async () => {
    if (isSubmitting) return;
    await form.handleSubmit(onSubmit)();
  };

  const handleFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) return;

    if (currentStep < STEP_TITLES.length) {
      await handleNextStep();
      return;
    }

    await handleCreateTournament();
  };

  const onSubmit = async (data: TournamentFormData) => {
    if (currentStep < STEP_TITLES.length) {
      await handleNextStep();
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const formatDateTime = (date: string, time?: string) => {
        if (!date) return null;

        if (!time) {
          const dateObj = new Date(`${date}T12:00:00`);
          return dateObj.toISOString();
        }

        const fullTime = time.length === 5 ? `${time}:00` : time;
        const localDate = new Date(`${date}T${fullTime}`);
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
        return;
      }

      throw new Error(result.error || 'Error desconocido al crear el torneo');
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
            <p className="text-lg font-medium text-slate-900">Preparando asistente...</p>
            <p className="text-sm text-slate-500">Cargando categorías, clubes y configuración</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <div className="bg-white/85 backdrop-blur-sm border-b border-slate-200/60 sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between gap-4">
            <Button asChild variant="ghost" size="sm" className="text-slate-600 hover:text-slate-900">
              <Link href="/tournaments">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver
              </Link>
            </Button>

            <div className="text-center">
              <div className="flex items-center justify-center gap-2">
                <Sparkles className="h-5 w-5 text-slate-900" />
                <h1 className="text-3xl font-light text-slate-900">Crear torneo</h1>
              </div>
              <p className="text-sm text-slate-500 mt-1">Un flujo más claro, con el mismo backend de siempre.</p>
            </div>

            <div className="flex items-center gap-2 text-right">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Paso actual</p>
                <p className="text-sm font-medium text-slate-800">{currentStep} de {STEP_TITLES.length}</p>
              </div>
              <Trophy className="h-7 w-7 text-slate-900" />
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Progreso del asistente</span>
              <span className="text-slate-700 font-medium">{STEP_TITLES[currentStep - 1].title}</span>
            </div>
            <Progress value={progressValue} className="h-2" />

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {STEP_TITLES.map((step) => {
                const Icon = step.icon;
                const isActive = currentStep === step.id;
                const isCompleted = currentStep > step.id;

                return (
                  <div
                    key={step.id}
                    className={cn(
                      'rounded-2xl border px-4 py-3 transition-colors',
                      isActive && 'border-slate-900 bg-slate-900 text-white shadow-sm',
                      isCompleted && 'border-emerald-200 bg-emerald-50 text-emerald-900',
                      !isActive && !isCompleted && 'border-slate-200 bg-white/70 text-slate-600'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-full border',
                          isActive && 'border-white/30 bg-white/10',
                          isCompleted && 'border-emerald-200 bg-white',
                          !isActive && !isCompleted && 'border-slate-200 bg-white'
                        )}
                      >
                        {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium">Paso {step.id}: {step.title}</p>
                        <p className={cn('text-xs mt-1', isActive ? 'text-slate-200' : isCompleted ? 'text-emerald-700' : 'text-slate-500')}>
                          {step.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        <div className="mx-auto max-w-5xl space-y-6">
          {error && (
            <Alert className="border-red-200/60 bg-red-50/70">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-700">{error}</AlertDescription>
            </Alert>
          )}

          {clubsError && (
            <Alert className="border-red-200/60 bg-red-50/70">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-700">{clubsError}</AlertDescription>
            </Alert>
          )}

          {successMessage && (
            <Alert className="border-emerald-200/60 bg-emerald-50/70">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              <AlertDescription className="text-emerald-700">{successMessage}</AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form onSubmit={handleFormSubmit} className="space-y-6">
              {currentStep === 1 && (
                <Card className="border-slate-200/60 bg-white/75 shadow-sm backdrop-blur-sm">
                  <CardHeader className="border-b border-slate-100 bg-slate-50/60">
                    <CardTitle className="flex items-center gap-3 text-xl font-light text-slate-900">
                      <Settings className="h-5 w-5 text-slate-700" />
                      Datos base del torneo
                    </CardTitle>
                    <CardDescription className="text-slate-500">
                      Primero definimos qué torneo estás creando y bajo qué formato va a competir.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-8 p-8">
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-700 font-medium">Nombre del torneo</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Ej: Torneo Apertura Club Norte"
                                className="border-slate-200/60 bg-white/80 focus:border-slate-900 focus:ring-slate-900"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="category_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-700 font-medium">Categoría</FormLabel>
                            <FormControl>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger className="border-slate-200/60 bg-white/80 focus:border-slate-900 focus:ring-slate-900">
                                  <SelectValue placeholder="Selecciona una categoría" />
                                </SelectTrigger>
                                <SelectContent>
                                  {categories.map((category) => (
                                    <SelectItem key={category.name} value={category.name}>
                                      {category.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 font-medium">Descripción</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Contá brevemente de qué se trata el torneo, cómo querés presentarlo o qué detalle deben saber los jugadores."
                              className="min-h-[110px] resize-none border-slate-200/60 bg-white/80 focus:border-slate-900 focus:ring-slate-900"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription className="text-slate-500">
                            Opcional, pero ayuda mucho a que la convocatoria se entienda mejor.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem className="space-y-4">
                          <div>
                            <FormLabel className="text-slate-700 font-medium">Tipo de torneo</FormLabel>
                            <p className="text-sm text-slate-500 mt-1">Elegí primero si el torneo se juega en una jornada o en varios días.</p>
                          </div>
                          <FormControl>
                            <RadioGroup
                              value={field.value}
                              onValueChange={field.onChange}
                              className="grid grid-cols-1 gap-4 md:grid-cols-2"
                            >
                              {(['AMERICAN', 'LONG'] as const).map((type) => {
                                const isSelected = field.value === type;
                                const copy = TYPE_COPY[type];

                                return (
                                  <label
                                    key={type}
                                    className={cn(
                                      'flex cursor-pointer rounded-2xl border p-5 transition-all',
                                      isSelected
                                        ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                                        : 'border-slate-200 bg-white/80 text-slate-800 hover:border-slate-300'
                                    )}
                                  >
                                    <RadioGroupItem value={type} className="mt-1 border-current text-current" />
                                    <div className="ml-4 flex-1">
                                      <div className="flex items-center justify-between gap-3">
                                        <div>
                                          <p className="text-base font-medium">{copy.title}</p>
                                          <p className={cn('mt-1 text-sm', isSelected ? 'text-slate-200' : 'text-slate-500')}>
                                            {copy.description}
                                          </p>
                                        </div>
                                        <Badge variant={isSelected ? 'secondary' : 'outline'} className={cn(isSelected && 'bg-white/10 text-white border-white/20')}>
                                          {copy.badge}
                                        </Badge>
                                      </div>
                                    </div>
                                  </label>
                                );
                              })}
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="format_preset"
                      render={({ field }) => (
                        <FormItem className="space-y-4">
                          <div>
                            <FormLabel className="text-slate-700 font-medium">Formato dentro de {TYPE_COPY[selectedType].title}</FormLabel>
                            <p className="text-sm text-slate-500 mt-1">
                              Acá definís cómo se organiza la competencia: zonas, cantidad de partidos y si termina en llave o copas.
                            </p>
                          </div>
                          <FormControl>
                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                              {presetOptions.map((preset) => {
                                const isSelected = field.value === preset.presetId;
                                const presetMeta = getPresetMeta(preset.presetId);

                                return (
                                  <button
                                    key={preset.presetId}
                                    type="button"
                                    onClick={() => field.onChange(preset.presetId)}
                                    className={cn(
                                      'rounded-2xl border p-5 text-left transition-all',
                                      isSelected
                                        ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                                        : 'border-slate-200 bg-white/80 text-slate-800 hover:border-slate-300 hover:bg-white'
                                    )}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <p className="text-base font-medium">{preset.display.name}</p>
                                        <p className={cn('mt-2 text-sm leading-relaxed', isSelected ? 'text-slate-200' : 'text-slate-500')}>
                                          {preset.display.description}
                                        </p>
                                      </div>
                                      {isSelected && (
                                        <div className="rounded-full border border-white/20 bg-white/10 p-2">
                                          <Check className="h-4 w-4" />
                                        </div>
                                      )}
                                    </div>

                                    <div className="mt-4 flex flex-wrap gap-2">
                                      {presetMeta.map((item) => (
                                        <Badge
                                          key={item}
                                          variant="outline"
                                          className={cn(
                                            'border-current/20 bg-transparent',
                                            isSelected ? 'text-white' : 'text-slate-600'
                                          )}
                                        >
                                          {item}
                                        </Badge>
                                      ))}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {selectedPreset && (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
                        <div className="flex items-start gap-3">
                          <Info className="h-5 w-5 text-slate-700 mt-0.5" />
                          <div className="space-y-3">
                            <div>
                              <p className="font-medium text-slate-900">{selectedPreset.display.name}</p>
                              <p className="text-sm text-slate-600 mt-1">{selectedPreset.display.description}</p>
                            </div>

                            {selectedPreset.advancementConfig.kind === 'SINGLE' && (
                              <FormField
                                control={form.control}
                                name="single_bracket_advance_count"
                                render={({ field }) => (
                                  <FormItem className="max-w-xs">
                                    <FormLabel className="text-slate-700 font-medium">Parejas que avanzan a la llave</FormLabel>
                                    <FormControl>
                                      <Input
                                        type="number"
                                        min="2"
                                        className="border-slate-200/60 bg-white/90 focus:border-slate-900 focus:ring-slate-900"
                                        value={field.value ?? ''}
                                        onChange={(event) => field.onChange(event.target.value ? Number(event.target.value) : undefined)}
                                      />
                                    </FormControl>
                                    <FormDescription className="text-slate-500">
                                      Podés ajustar cuántas parejas pasan a la etapa final.
                                    </FormDescription>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            )}

                            {selectedPreset.advancementConfig.kind === 'GOLD_SILVER' && (
                              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                <FormField
                                  control={form.control}
                                  name="gold_count"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-slate-700 font-medium">Copa Oro</FormLabel>
                                      <FormControl>
                                        <Input
                                          type="number"
                                          min="0"
                                          className="border-slate-200/60 bg-white/90 focus:border-slate-900 focus:ring-slate-900"
                                          value={field.value ?? ''}
                                          onChange={(event) => field.onChange(event.target.value ? Number(event.target.value) : undefined)}
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
                                      <FormLabel className="text-slate-700 font-medium">Copa Plata</FormLabel>
                                      <FormControl>
                                        <Input
                                          type="number"
                                          min="0"
                                          className="border-slate-200/60 bg-white/90 focus:border-slate-900 focus:ring-slate-900"
                                          value={field.value ?? ''}
                                          onChange={(event) => field.onChange(event.target.value ? Number(event.target.value) : undefined)}
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
                                      <FormLabel className="text-slate-700 font-medium">Eliminadas</FormLabel>
                                      <FormControl>
                                        <Input
                                          type="number"
                                          min="0"
                                          className="border-slate-200/60 bg-white/90 focus:border-slate-900 focus:ring-slate-900"
                                          value={field.value ?? ''}
                                          onChange={(event) => field.onChange(event.target.value ? Number(event.target.value) : undefined)}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    <Separator className="bg-slate-100" />

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="gender"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-700 font-medium">Género</FormLabel>
                            <FormControl>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger className="border-slate-200/60 bg-white/80 focus:border-slate-900 focus:ring-slate-900">
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
                        name="club_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-700 font-medium">
                              <Building2 className="h-4 w-4 inline mr-1" />
                              {userRole === 'ORGANIZADOR' ? 'Club principal' : 'Tu club'}
                            </FormLabel>
                            <FormControl>
                              {userRole === 'ORGANIZADOR' ? (
                                <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting}>
                                  <SelectTrigger className="border-slate-200/60 bg-white/80 focus:border-slate-900 focus:ring-slate-900">
                                    <SelectValue placeholder="Selecciona un club" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {clubs.map((club) => (
                                      <SelectItem key={club.id} value={club.id}>
                                        <div className="flex items-center gap-2">
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
                                    className="border-slate-200/60 bg-slate-50/80 pr-24"
                                  />
                                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <Badge variant="outline" className="text-xs">Asignado</Badge>
                                  </div>
                                </div>
                              )}
                            </FormControl>
                            {userRole === 'ORGANIZADOR' && clubs.length === 0 && (
                              <FormDescription className="text-amber-600">
                                No tenés clubes asociados a tu organización.
                              </FormDescription>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

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
                                    className="inline-flex h-11 w-full items-center justify-between rounded-md border border-slate-200/60 bg-white/80 px-3 py-2 text-sm text-slate-700 ring-offset-background focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
                                  >
                                    <span>
                                      {extraClubIds.length === 0
                                        ? 'Sumar clubes relacionados al torneo'
                                        : `${extraClubIds.length} club${extraClubIds.length > 1 ? 'es' : ''} adicional${extraClubIds.length > 1 ? 'es' : ''}`}
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
                                            <span className="flex-1">{club.name}</span>
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
                            <FormDescription className="text-slate-500">
                              Opcional. Sirve para vincular el torneo a más de un club sin cambiar el backend actual.
                            </FormDescription>
                            {selectedExtraClubs.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {selectedExtraClubs.map((club) => (
                                  <Badge key={club.id} variant="outline" className="border-slate-200 bg-white/80 px-2 py-1">
                                    <span className="mr-2">{club.name}</span>
                                    <button
                                      type="button"
                                      aria-label={`Quitar ${club.name}`}
                                      onClick={() => handleToggleExtraClub(club.id)}
                                      className="rounded-sm text-slate-500 hover:bg-slate-100"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  </Badge>
                                ))}
                              </div>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </CardContent>
                </Card>
              )}

              {currentStep === 2 && (
                <Card className="border-slate-200/60 bg-white/75 shadow-sm backdrop-blur-sm">
                  <CardHeader className="border-b border-slate-100 bg-slate-50/60">
                    <CardTitle className="flex items-center gap-3 text-xl font-light text-slate-900">
                      <CalendarDays className="h-5 w-5 text-slate-700" />
                      Agenda del torneo
                    </CardTitle>
                    <CardDescription className="text-slate-500">
                      {isAmericanTournament
                        ? 'Como es un torneo americano, definimos claramente cuándo empieza.'
                        : 'Como es un torneo long, definimos inicio y una fecha estimada de cierre.'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-8 p-8">
                    <div className="rounded-2xl border border-blue-200/70 bg-blue-50/70 p-5">
                      <div className="flex items-start gap-3">
                        <Info className="h-5 w-5 text-blue-700 mt-0.5" />
                        <div>
                          <p className="font-medium text-blue-900">{TYPE_COPY[selectedType].title}</p>
                          <p className="mt-1 text-sm text-blue-800">
                            {isAmericanTournament
                              ? 'Te vamos a pedir fecha y hora de inicio porque este formato se organiza como una sola jornada.'
                              : 'Te vamos a pedir fecha de inicio y una fecha aproximada de finalización. La hora final ya no se solicita en esta pantalla.'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className={cn('grid gap-6', isAmericanTournament ? 'md:grid-cols-2' : 'md:grid-cols-2')}>
                      <FormField
                        control={form.control}
                        name="start_date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-700 font-medium">
                              <Calendar className="h-4 w-4 inline mr-1" />
                              Fecha de inicio
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                min={new Date().toISOString().split('T')[0]}
                                className="border-slate-200/60 bg-white/80 focus:border-slate-900 focus:ring-slate-900"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {isAmericanTournament ? (
                        <FormField
                          control={form.control}
                          name="start_time"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-slate-700 font-medium">
                                <Clock className="h-4 w-4 inline mr-1" />
                                Hora de inicio
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="time"
                                  className="border-slate-200/60 bg-white/80 focus:border-slate-900 focus:ring-slate-900"
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription className="text-slate-500">
                                Obligatoria para torneos americanos.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ) : (
                        <FormField
                          control={form.control}
                          name="end_date"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-slate-700 font-medium">
                                <Calendar className="h-4 w-4 inline mr-1" />
                                Fecha aproximada de finalización
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="date"
                                  min={watchedValues.start_date || new Date().toISOString().split('T')[0]}
                                  className="border-slate-200/60 bg-white/80 focus:border-slate-900 focus:ring-slate-900"
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription className="text-slate-500">
                                Obligatoria para torneos long.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {currentStep === 3 && (
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                  <Card className="border-slate-200/60 bg-white/75 shadow-sm backdrop-blur-sm">
                    <CardHeader className="border-b border-slate-100 bg-slate-50/60">
                      <CardTitle className="flex items-center gap-3 text-xl font-light text-slate-900">
                        <Users className="h-5 w-5 text-slate-700" />
                        Cupo, precio y premio
                      </CardTitle>
                      <CardDescription className="text-slate-500">
                        Últimos detalles antes de crear el torneo.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-8 p-8">
                      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="max_participants"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-slate-700 font-medium">
                                <Users className="h-4 w-4 inline mr-1" />
                                Máximo de parejas
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="2"
                                  max="64"
                                  placeholder="Ej: 16"
                                  className="border-slate-200/60 bg-white/80 focus:border-slate-900 focus:ring-slate-900"
                                  value={field.value ?? ''}
                                  onChange={(event) => field.onChange(event.target.value ? Number(event.target.value) : undefined)}
                                />
                              </FormControl>
                              <FormDescription className="text-slate-500">
                                Opcional. Si lo dejás vacío, el torneo queda sin tope definido.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="price"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-slate-700 font-medium">
                                <Tag className="h-4 w-4 inline mr-1" />
                                Precio de inscripción
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="0"
                                  max="32767"
                                  step="1"
                                  placeholder="Ej: 5000"
                                  className="border-slate-200/60 bg-white/80 focus:border-slate-900 focus:ring-slate-900"
                                  value={field.value ?? ''}
                                  onChange={(event) => field.onChange(event.target.value ? Number(event.target.value) : undefined)}
                                />
                              </FormControl>
                              <FormDescription className="text-slate-500">
                                Opcional. Solo números enteros, igual que en el flujo actual.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

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
                                placeholder="Ej: Trofeos + efectivo"
                                className="border-slate-200/60 bg-white/80 focus:border-slate-900 focus:ring-slate-900"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription className="text-slate-500">
                              Opcional. Se guarda exactamente como texto, igual que ahora.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>

                  <Card className="border-slate-200/60 bg-white/85 shadow-sm backdrop-blur-sm">
                    <CardHeader className="border-b border-slate-100 bg-slate-50/60">
                      <CardTitle className="text-xl font-light text-slate-900">Resumen final</CardTitle>
                      <CardDescription className="text-slate-500">
                        Revisá todo antes de crear. El backend y las reglas siguen siendo las mismas.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5 p-8">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Torneo</p>
                        <p className="mt-2 text-lg font-medium text-slate-900">{watchedValues.name || 'Sin nombre todavía'}</p>
                        <p className="mt-1 text-sm text-slate-600">{watchedValues.description?.trim() || 'Sin descripción'}</p>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-slate-200 bg-white/80 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Tipo</p>
                          <p className="mt-2 font-medium text-slate-900">{TYPE_COPY[selectedType].title}</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white/80 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Formato</p>
                          <p className="mt-2 font-medium text-slate-900">{selectedPreset?.display.name || 'Sin definir'}</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white/80 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Categoría y género</p>
                          <p className="mt-2 font-medium text-slate-900">
                            {watchedValues.category_name || 'Sin categoría'} · {watchedValues.gender === 'MALE' ? 'Masculino' : watchedValues.gender === 'FEMALE' ? 'Femenino' : 'Mixto'}
                          </p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white/80 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Club principal</p>
                          <p className="mt-2 font-medium text-slate-900">{selectedClub?.name || 'Sin definir'}</p>
                        </div>
                      </div>

                      {selectedExtraClubs.length > 0 && (
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Clubes adicionales</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {selectedExtraClubs.map((club) => (
                              <Badge key={club.id} variant="outline" className="border-slate-200 bg-white/80">
                                {club.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      <Separator className="bg-slate-100" />

                      <div className="space-y-3 text-sm">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-500">Inicio</span>
                          <span className="font-medium text-slate-900">
                            {formatInputDate(watchedValues.start_date)}
                            {isAmericanTournament && watchedValues.start_time ? ` · ${watchedValues.start_time}` : ''}
                          </span>
                        </div>

                        {!isAmericanTournament && (
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-500">Finalización estimada</span>
                            <span className="font-medium text-slate-900">{formatInputDate(watchedValues.end_date || '')}</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-500">Máximo de parejas</span>
                          <span className="font-medium text-slate-900">{watchedValues.max_participants || 'Sin tope'}</span>
                        </div>

                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-500">Inscripción</span>
                          <span className="font-medium text-slate-900">{formatCurrency(watchedValues.price)}</span>
                        </div>

                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-500">Premio</span>
                          <span className="text-right font-medium text-slate-900">{watchedValues.award?.trim() || 'Sin definir'}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              <div className="flex flex-col gap-4 border-t border-slate-200/70 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <Button asChild variant="outline" size="lg">
                  <Link href="/tournaments">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Cancelar
                  </Link>
                </Button>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  {selectedClub && (
                    <div className="text-sm text-slate-500 sm:mr-2">
                      Se crea en <span className="font-medium text-slate-700">{selectedClub.name}</span>
                    </div>
                  )}

                  {currentStep > 1 && (
                    <Button type="button" variant="outline" size="lg" onClick={handlePreviousStep}>
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Volver
                    </Button>
                  )}

                  {currentStep < STEP_TITLES.length ? (
                    <Button type="button" size="lg" className="bg-slate-900 hover:bg-slate-800" onClick={() => void handleNextStep()}>
                      Siguiente
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  ) : (
                    <Button type="button" size="lg" className="bg-slate-900 hover:bg-slate-800" disabled={isSubmitting} onClick={() => void handleCreateTournament()}>
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Creando torneo...
                        </>
                      ) : (
                        <>
                          <Trophy className="h-4 w-4 mr-2" />
                          Crear torneo
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
