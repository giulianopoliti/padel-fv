# 🏆 SISTEMA DE FECHAS PARA TORNEOS LARGOS

## 📋 **RESUMEN EJECUTIVO**

Se ha implementado exitosamente un **sistema completo de fechas** para torneos LONG que permite:

- ✅ **Organizadores crear franjas horarias flexibles**
- ✅ **Jugadores marcar disponibilidad específica dentro de esas franjas**
- ✅ **Organizadores programar partidos basándose en disponibilidad real**
- ✅ **Organizar partidos por fechas numeradas** (Fecha 1, Fecha 2, etc.)
- ✅ **Arquitectura completamente reutilizable** para formatos futuros

---

## 🎯 **ARQUITECTURA IMPLEMENTADA**

### **📊 TABLAS PRINCIPALES**

#### **1. `tournament_fechas` - Fechas Conceptuales**
```sql
tournament_fechas (
  id uuid PRIMARY KEY,
  tournament_id uuid REFERENCES tournaments(id),
  fecha_number integer NOT NULL,           -- 1, 2, 3...
  name text NOT NULL,                      -- "Fecha 1", "Cuartos de Final"
  description text,                        -- Descripción opcional
  start_date date,                         -- Rango de fechas
  end_date date,
  status fecha_status DEFAULT 'NOT_STARTED', -- Estado de la fecha
  is_qualifying boolean DEFAULT false,     -- True para clasificatorias
  max_matches_per_couple integer,          -- Límite por pareja
  created_at timestamptz,
  updated_at timestamptz
);
```

#### **2. `tournament_time_slots` - Horarios Específicos**
```sql
tournament_time_slots (
  id uuid PRIMARY KEY,
  fecha_id uuid REFERENCES tournament_fechas(id),
  date date NOT NULL,                      -- Día específico
  start_time time NOT NULL,                -- "11:00"
  end_time time NOT NULL,                  -- "16:00"
  court_name text,                         -- "Cancha 1"
  max_matches integer DEFAULT 1,          -- Partidos simultáneos
  description text,                        -- "Sábado mañana"
  is_available boolean DEFAULT true,      -- Organizador control
  created_at timestamptz
);
```

#### **3. `fecha_matches` - Vinculación Partidos**
```sql
fecha_matches (
  id uuid PRIMARY KEY,
  fecha_id uuid REFERENCES tournament_fechas(id),
  match_id uuid REFERENCES matches(id) UNIQUE,
  scheduled_time_slot_id uuid REFERENCES tournament_time_slots(id),
  match_order integer,                     -- Orden dentro de fecha
  notes text,                              -- Notas del organizador
  schedule_algo start-- no recuerdo el nombre pero es para el inicio del partido
  schedule_algo end -- no recuerdo el nombre, pero es para el final del partido
  created_at timestamptz,
  updated_at timestamptz
);
```

#### **4. `couple_time_availability` - Sistema de Disponibilidad**
```sql
couple_time_availability (
  id uuid PRIMARY KEY,
  couple_id uuid REFERENCES couples(id),
  time_slot_id uuid REFERENCES tournament_time_slots(id),
  
  -- DISPONIBILIDAD BÁSICA
  is_available boolean DEFAULT false,
  
  -- FLEXIBILIDAD HORARIA (INNOVACIÓN CLAVE)
  preferred_start_time time,               -- "13:00" dentro del slot
  preferred_end_time time,                 -- "16:00" dentro del slot
  can_start_earlier boolean DEFAULT false, -- ¿Antes del slot?
  can_finish_later boolean DEFAULT false,  -- ¿Después del slot?
  minimum_duration_minutes integer DEFAULT 90,
  
  -- COMUNICACIÓN Y PRIORIZACIÓN
  notes text,                              -- "Solo después del almuerzo"
  priority_level integer DEFAULT 3,       -- 1-5 (5=alta prioridad)
  flexibility_level flexibility_level DEFAULT 'MEDIUM',
  
  created_at timestamptz,
  updated_at timestamptz,
  UNIQUE(couple_id, time_slot_id)
);
```

#### **5. `couple_fecha_stats` - Estadísticas por Fecha**
```sql
couple_fecha_stats (
  id uuid PRIMARY KEY,
  fecha_id uuid REFERENCES tournament_fechas(id),
  couple_id uuid REFERENCES couples(id),
  matches_played integer DEFAULT 0,
  matches_won integer DEFAULT 0,
  matches_lost integer DEFAULT 0,
  sets_won integer DEFAULT 0,
  sets_lost integer DEFAULT 0,
  games_won integer DEFAULT 0,
  games_lost integer DEFAULT 0,
  games_difference integer DEFAULT 0,
  points_earned integer DEFAULT 0,
  created_at timestamptz,
  updated_at timestamptz,
  last_calculated_at timestamptz,
  UNIQUE(fecha_id, couple_id)
);
```

---

## 🔄 **FLUJO DE USUARIO COMPLETO**

### **PASO 1: Organizador Crea Franjas Horarias**
```sql
-- Crear fecha conceptual
INSERT INTO tournament_fechas (tournament_id, fecha_number, name, is_qualifying)
VALUES ('tournament_uuid', 1, 'Fecha 1', true);

-- Crear horarios disponibles para esa fecha
INSERT INTO tournament_time_slots (fecha_id, date, start_time, end_time, court_name, description)
VALUES 
('fecha_uuid', '2025-03-01', '11:00', '16:00', 'Cancha 1', 'Sábado mañana/tarde'),
('fecha_uuid', '2025-03-01', '11:00', '16:00', 'Cancha 2', 'Sábado mañana/tarde'),
('fecha_uuid', '2025-03-02', '09:00', '13:00', 'Cancha 1', 'Domingo mañana');
```

### **PASO 2: Jugadores Marcan Disponibilidad Flexible**
```sql
-- Pareja marca disponibilidad específica dentro del slot
INSERT INTO couple_time_availability (
  couple_id, 
  time_slot_id, 
  is_available, 
  preferred_start_time, 
  preferred_end_time,
  notes,
  priority_level
) VALUES (
  'couple_uuid',
  'timeslot_uuid', 
  true,
  '13:00',                    -- "De 13 a 16hs podemos"
  '16:00',
  'Solo después del almuerzo', -- Comentario del usuario
  4                           -- Alta prioridad
);
```

### **PASO 3: Organizador Ve Data Agregada**
```sql
-- Vista para ayudar al organizador
SELECT 
  tf.name as fecha_name,
  ts.date,
  ts.start_time,
  ts.end_time,
  ts.court_name,
  COUNT(ca.couple_id) FILTER (WHERE ca.is_available = true) as available_couples,
  COUNT(ca.couple_id) FILTER (WHERE ca.priority_level >= 4) as high_priority_couples,
  MIN(ca.preferred_start_time) as earliest_preferred_start,
  MAX(ca.preferred_end_time) as latest_preferred_end,
  STRING_AGG(ca.notes, ' | ') FILTER (WHERE ca.notes IS NOT NULL) as all_notes
FROM organizer_scheduling_helper
WHERE tf.tournament_id = $1
GROUP BY tf.id, ts.id;
```

### **PASO 4: Organizador Programa Partidos**
```sql
-- Crear partido normal
INSERT INTO matches (tournament_id, couple1_id, couple2_id, round)
VALUES ('tournament_uuid', 'couple1_uuid', 'couple2_uuid', 'ZONE');

-- Vincularlo con fecha (SIN horario específico aún)
INSERT INTO fecha_matches (fecha_id, match_id, match_order)
VALUES ('fecha_uuid', 'match_uuid', 1);

-- OPCIONALMENTE: Asignar horario específico
UPDATE fecha_matches 
SET scheduled_time_slot_id = 'timeslot_uuid'
WHERE match_id = 'match_uuid';
```

---

## 🚀 **FUNCIONALIDADES IMPLEMENTADAS**

### **✅ Flexibilidad Horaria Total**
- Organizadores crean **franjas amplias** (ej: "Sábado 11-16hs")
- Jugadores especifican **horarios preferidos dentro** de esas franjas
- Sistema no restrictivo: **disponibilidad = sugerencia, no obligación**

### **✅ Sistema de Priorización**
- `priority_level` (1-5): Parejas indican qué horarios prefieren más
- `flexibility_level` (INFLEXIBLE, LOW, MEDIUM, HIGH, VERY_HIGH)
- `notes` para comunicación directa ("Solo después del almuerzo")

### **✅ Herramientas para Organizadores**
- **Vista `organizer_scheduling_helper`**: Data agregada para toma de decisiones
- **Vista `fecha_summary`**: Resumen ejecutivo por fecha
- **Índices optimizados** para consultas frecuentes

### **✅ Escalabilidad Futura**
- **Reutilizable para cualquier formato**: Liga, Copa, Todos contra Todos
- **Configuración por `format_config`** en tabla `tournaments`
- **Sistema de fechas numeradas** extensible infinitamente

### **✅ Integridad y Performance**
- **Constraints y validaciones** completas
- **Triggers automáticos** para `updated_at`
- **Índices estratégicos** para consultas rápidas
- **Documentación exhaustiva** en comentarios SQL

---

## 📱 **EJEMPLOS DE USO**

### **🎾 Torneo Largo Clásico**
```sql
-- Fecha 1: Jornada Clasificatoria
INSERT INTO tournament_fechas VALUES (uuid, tournament_id, 1, 'Fecha 1', 'Primera jornada', true);

-- Fecha 2: Jornada Clasificatoria  
INSERT INTO tournament_fechas VALUES (uuid, tournament_id, 2, 'Fecha 2', 'Segunda jornada', true);

-- Fecha 3: Cuartos de Final
INSERT INTO tournament_fechas VALUES (uuid, tournament_id, 3, 'Cuartos de Final', 'Eliminación directa', false);
```

### **⚽ Todos Contra Todos**
```sql
-- Jornada 1, 2, 3... N (hasta completar round-robin)
INSERT INTO tournament_fechas VALUES (uuid, tournament_id, 1, 'Jornada 1', 'Round robin', true);
INSERT INTO tournament_fechas VALUES (uuid, tournament_id, 2, 'Jornada 2', 'Round robin', true);
-- ... continuar hasta que todos jueguen contra todos
```

### **🏢 Liga Empresarial**
```sql
-- Horarios después del trabajo
INSERT INTO tournament_time_slots VALUES (
  uuid, fecha_id, '2025-03-01', '18:00', '22:00', 'Cancha Central', 
  'Horario post-laboral'
);
```

---

## 🛠️ **CONSULTAS ÚTILES IMPLEMENTADAS**

### **📊 Dashboard de Organizador**
```sql
-- Ver disponibilidad por fecha con estadísticas
SELECT * FROM organizer_scheduling_helper 
WHERE fecha_id = $1 
ORDER BY available_couples DESC;
```

### **📈 Resumen Ejecutivo**
```sql
-- Estadísticas generales por fecha
SELECT * FROM fecha_summary 
WHERE tournament_id = $1 
ORDER BY fecha_number;
```

### **🔍 Partidos Sin Programar**
```sql
-- Partidos que necesitan horario
SELECT m.*, tf.name as fecha_name
FROM fecha_matches fm
JOIN matches m ON fm.match_id = m.id
JOIN tournament_fechas tf ON fm.fecha_id = tf.id
WHERE fm.scheduled_time_slot_id IS NULL
AND tf.tournament_id = $1;
```

### **📅 Horarios con Mayor Disponibilidad**
```sql
-- Mejores slots para programar
SELECT 
  ts.*,
  COUNT(ca.couple_id) FILTER (WHERE ca.is_available = true) as available_couples
FROM tournament_time_slots ts
LEFT JOIN couple_time_availability ca ON ts.id = ca.time_slot_id
WHERE ts.fecha_id = $1
GROUP BY ts.id
ORDER BY available_couples DESC;
```

---

## 🎯 **CASOS DE USO ESCALABLES**

### **🔄 Formato Flexible**
El sistema se adapta automáticamente a cualquier configuración:

```json
// En tournaments.format_config
{
  "fechas_type": "ROUND_ROBIN",           // CLASIFICATORY, ELIMINATION, ROUND_ROBIN
  "max_fechas": null,                     // null = ilimitado
  "scheduling_mode": "FLEXIBLE",          // FLEXIBLE, STRICT, AUTOMATIC
  "default_time_slots": [
    {"day": "SATURDAY", "start": "09:00", "end": "18:00"},
    {"day": "SUNDAY", "start": "09:00", "end": "13:00"}
  ]
}
```

### **📊 Reportes Avanzados**
```sql
-- Performance por fecha
SELECT 
  tf.name,
  AVG(cfs.points_earned) as avg_points,
  COUNT(cfs.matches_played) as total_matches
FROM couple_fecha_stats cfs
JOIN tournament_fechas tf ON cfs.fecha_id = tf.id
WHERE tf.tournament_id = $1
GROUP BY tf.id, tf.name
ORDER BY tf.fecha_number;
```

---

## ✅ **MIGRACIÓN APLICADA EXITOSAMENTE**

### **📋 Estado de la Implementación**
- ✅ **5 tablas principales** creadas y configuradas
- ✅ **2 ENUMs** (`fecha_status`, `flexibility_level`) implementados
- ✅ **15+ índices** para optimización de performance
- ✅ **2 vistas especializadas** para organizadores
- ✅ **Triggers automáticos** para consistency
- ✅ **Constraints completos** para integridad de datos
- ✅ **Documentación exhaustiva** en comentarios SQL

### **🔗 Referencias Establecidas**
- `tournament_fechas` → `tournaments` (CASCADE DELETE)
- `tournament_time_slots` → `tournament_fechas` (CASCADE DELETE)
- `fecha_matches` → `tournament_fechas` + `matches` + `tournament_time_slots`
- `couple_time_availability` → `couples` + `tournament_time_slots` (CASCADE DELETE)
- `couple_fecha_stats` → `tournament_fechas` + `couples` (CASCADE DELETE)

### **⚡ Performance**
- **Consultas optimizadas** con índices estratégicos
- **Vistas materializadas** para reportes complejos
- **Triggers eficientes** para actualización automática
- **Constraints inteligentes** para validación rápida

---

## 🚀 **PRÓXIMOS PASOS**

### **1. Frontend Implementation**
- Interfaz de creación de fechas para organizadores
- Sistema de disponibilidad para jugadores
- Dashboard de programación inteligente

### **2. API Development**
- Endpoints para CRUD de fechas y horarios
- APIs para disponibilidad de parejas
- Servicios de sugerencias automáticas

### **3. Advanced Features**
- Algoritmos de scheduling automático
- Notificaciones push para cambios
- Integración con calendarios externos

---

## 📞 **SOPORTE Y DOCUMENTATION**

### **🔍 Debugging**
```sql
-- Verificar integridad del sistema
SELECT 
  COUNT(*) as total_fechas,
  COUNT(DISTINCT tournament_id) as tournaments_with_fechas
FROM tournament_fechas;

-- Ver sistema completo para un torneo
SELECT 
  tf.name as fecha,
  ts.date,
  ts.start_time,
  ts.court_name,
  COUNT(ca.couple_id) as couples_with_availability
FROM tournament_fechas tf
LEFT JOIN tournament_time_slots ts ON tf.id = ts.fecha_id
LEFT JOIN couple_time_availability ca ON ts.id = ca.time_slot_id
WHERE tf.tournament_id = $1
GROUP BY tf.id, ts.id
ORDER BY tf.fecha_number, ts.date, ts.start_time;
```

### **📚 Migration Information**
- **Migration Name**: `create_long_tournament_fecha_system`
- **Applied On**: 2025-08-29 04:09:50 UTC
- **Branch**: `tournament-long` (cmrpksecpkrpocumtjmf)
- **Total Tables Created**: 5
- **Total Views Created**: 2
- **Status**: ✅ **SUCCESSFUL**

---

**🎯 El sistema está listo para uso inmediato y escalable para cualquier formato futuro.**
