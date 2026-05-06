# Script de Limpieza de Datos de Torneos

## Descripción

Este script permite limpiar completamente los datos de un torneo específico y resetear su estado a la fase de zonas. Es útil para reiniciar un torneo que ya tiene datos de partidos, brackets o seeds generados.

## ¿Qué hace el script?

1. **Elimina registros en orden correcto:**
   - `match_hierarchy` (jerarquía de partidos)
   - `matches` (partidos **EXCEPTO** los que tienen `round=ZONE`)
   - `tournament_couple_seeds` (seeds de parejas)

2. **Resetea el estado del torneo:**
   - `status` → `ZONE_PHASE`
   - `bracket_status` → `NOT_STARTED`
   - Limpia campos relacionados con brackets generados

## Uso

### Prerequisitos

1. Asegúrate de tener las variables de entorno configuradas en `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=tu_url_supabase
   SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
   ```

2. El script requiere permisos de service role para poder eliminar registros.

### Ejecución

```bash
# Usando npm script (recomendado)
npm run cleanup-tournament <tournament-id>

# Ejemplo
npm run cleanup-tournament 123e4567-e89b-12d3-a456-426614174000
```

### Parámetros

- `<tournament-id>`: ID del torneo que quieres limpiar (UUID)

## Ejemplo de Salida

```
🚀 Starting tournament data cleanup script...

✅ Connected to Supabase

🎯 Target tournament ID: 123e4567-e89b-12d3-a456-426614174000

📋 Step 1: Verifying tournament exists...
✅ Tournament found: "Torneo de Ejemplo"
   Current status: BRACKET_PHASE
   Current bracket_status: BRACKET_GENERATED

📋 Step 2: Counting existing records...
📊 Existing records:
   match_hierarchy: 15
   matches: 8 (ZONE: 5, Others: 3)
   tournament_couple_seeds: 12

📋 Step 3: Deleting match_hierarchy records...
✅ Deleted 15 match_hierarchy records

📋 Step 4: Deleting matches records (excluding ZONE round matches)...
✅ Deleted 8 matches records

📋 Step 5: Deleting tournament_couple_seeds records...
✅ Deleted 12 tournament_couple_seeds records

📋 Step 6: Updating tournament status...
✅ Tournament status updated to ZONE_PHASE and bracket_status to NOT_STARTED

======================================================================
📊 CLEANUP SUMMARY
======================================================================
Tournament: "Torneo de Ejemplo" (123e4567-e89b-12d3-a456-426614174000)
✅ match_hierarchy deleted:     15
✅ matches deleted:             8
✅ tournament_couple_seeds deleted: 12
✅ Tournament status updated:   Yes
❌ Errors:                      0
======================================================================

📋 Step 8: Verification - Checking final state...
📊 Final state:
   match_hierarchy remaining: 0
   matches remaining: 5 (ZONE: 5, Others: 0)
   tournament_couple_seeds remaining: 0
   Tournament status: ZONE_PHASE
   Tournament bracket_status: NOT_STARTED

✅ Cleanup script completed successfully!
```

## Advertencias Importantes

⚠️ **ADVERTENCIA**: Este script elimina datos permanentemente. No hay manera de recuperar los datos una vez eliminados.

⚠️ **BACKUP**: Siempre haz un backup de la base de datos antes de ejecutar este script en producción.

⚠️ **VERIFICACIÓN**: El script muestra un resumen detallado de lo que se va a eliminar. Revisa cuidadosamente antes de confirmar.

## Casos de Uso

- Reiniciar un torneo que tiene datos corruptos
- Limpiar datos de prueba de un torneo en desarrollo
- Resetear un torneo para volver a generar brackets (manteniendo matches de ZONE)
- Limpiar datos de un torneo que se canceló y se quiere reiniciar
- Limpiar solo los brackets eliminación pero mantener los partidos de zonas

## Troubleshooting

### Error: "Tournament not found"
- Verifica que el ID del torneo sea correcto
- Asegúrate de que el torneo existe en la base de datos

### Error: "Missing SUPABASE env vars"
- Verifica que `.env.local` esté en la raíz del proyecto
- Asegúrate de que las variables de entorno estén correctamente configuradas

### Error de permisos
- Verifica que `SUPABASE_SERVICE_ROLE_KEY` tenga permisos suficientes
- El script necesita permisos para eliminar registros de las tablas mencionadas

## Estructura del Script

El script está diseñado siguiendo las mejores prácticas:

1. **Validación de entrada**: Verifica parámetros y variables de entorno
2. **Verificación de existencia**: Confirma que el torneo existe
3. **Conteo previo**: Muestra cuántos registros se van a eliminar
4. **Eliminación ordenada**: Elimina en el orden correcto para evitar errores de FK
5. **Actualización de estado**: Resetea el estado del torneo
6. **Verificación final**: Confirma que la operación fue exitosa
7. **Reporte detallado**: Muestra un resumen completo de la operación
