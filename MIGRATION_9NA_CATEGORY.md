# Migración: Agregar 9na Categoría

## 📋 Resumen

Esta migración agrega una nueva categoría **9na** (0-299 puntos) al sistema y desplaza todas las categorías existentes, sumando 300 puntos a todos los jugadores para mantenerlos en su categoría relativa.

## 🎯 Objetivos

- ✅ Agregar categoría 9na con rango 0-299 puntos
- ✅ Mantener a todos los jugadores en su categoría relativa actual
- ✅ Actualizar automáticamente los rangos de todas las categorías
- ✅ Preservar la integridad referencial de la base de datos

## 📊 Cambios en las Categorías

### Antes de la Migración
| Categoría | Rango Anterior |
|-----------|----------------|
| 6ta       | 600 - 899      |
| 7ma       | 300 - 599      |
| 8va       | 0 - 299        |

### Después de la Migración
| Categoría | Rango Nuevo    |
|-----------|----------------|
| 6ta       | 900 - 1199     |
| 7ma       | 600 - 899      |
| 8va       | 300 - 599      |
| **9na**   | **0 - 299**    |

## 🔄 Proceso de Migración

### FASE 1: Testing en Desarrollo Local (✅ COMPLETADO)

1. **Script ejecutado:** `add_9na_category_with_commit.sql`
2. **Base de datos:** Local (Docker)
3. **Resultados:**
   - ✅ 4 categorías creadas correctamente
   - ✅ 29 jugadores actualizados (+300 puntos)
   - ✅ Distribución final:
     - 4 jugadores en 6ta (900-1008 pts)
     - 21 jugadores en 7ma (600-794 pts)
     - 4 jugadores en 8va (321-596 pts)
     - 0 jugadores en 9na (0-299 pts)
   - ✅ Integridad verificada: 0 errores

### FASE 2: Actualización del Frontend (✅ COMPLETADO)

Archivos modificados:
1. ✅ `app/(main)/info/categorias/page.tsx`
   - Agregada categoría 9na al inicio del array
   - Actualizados rangos de todas las categorías (8va, 7ma, 6ta, 5ta, 4ta, 3ra, 2da, 1ra)

2. ✅ `components/home/InfoSection.tsx`
   - Actualizado texto de "8 categorías" a "9 categorías"
   - Actualizado rango informativo: "9na (0-299 pts) hasta 1ra (2400+ pts)"

### FASE 3: Migración a Producción (⏳ PENDIENTE)

#### Pre-requisitos
- [ ] Commit y push de todos los cambios frontend
- [ ] Verificación de que el sitio funciona correctamente en desarrollo
- [ ] Coordinación de ventana de mantenimiento (si es necesario)
- [ ] Backup de base de datos de producción

#### Pasos de Ejecución

##### Opción A: Usando Supabase Dashboard (RECOMENDADO)

1. **Acceder al Dashboard de Supabase**
   - Ir a: https://supabase.com/dashboard
   - Seleccionar el proyecto de producción

2. **Crear Backup Manual (CRÍTICO)**
   ```
   Dashboard → Database → Backups → Create Backup
   Nombre: "pre-9na-category-migration-2025-11-07"
   ```

3. **Aplicar Migración**
   - Ir a: SQL Editor
   - Copiar el contenido de `supabase/migrations/20251107000000_add_9na_category.sql`
   - Pegar en el editor
   - Revisar el SQL
   - Click en "Run" (ejecutar)

4. **Verificar Resultados**
   ```sql
   -- Verificar categorías
   SELECT name, lower_range, upper_range
   FROM categories
   ORDER BY lower_range;

   -- Verificar distribución de jugadores
   SELECT
       category_name,
       COUNT(*) as cantidad,
       MIN(score) as score_min,
       MAX(score) as score_max
   FROM players
   WHERE score IS NOT NULL
   GROUP BY category_name
   ORDER BY MIN(score) DESC;

   -- Verificar integridad
   SELECT COUNT(*) as jugadores_sin_categoria
   FROM players
   WHERE score IS NOT NULL AND category_name IS NULL;
   ```

##### Opción B: Usando Supabase CLI

1. **Conectar a producción**
   ```bash
   # Asegurarse de tener las variables de entorno correctas
   export SUPABASE_ACCESS_TOKEN=<your-production-token>
   export SUPABASE_DB_PASSWORD=<your-production-db-password>
   ```

2. **Link al proyecto de producción**
   ```bash
   npx supabase link --project-ref <your-project-ref>
   ```

3. **Verificar migraciones pendientes**
   ```bash
   npx supabase db push --dry-run
   ```

4. **Aplicar migración**
   ```bash
   npx supabase db push
   ```

5. **Verificar aplicación exitosa**
   ```bash
   npx supabase db remote commit list
   ```

##### Opción C: SQL Directo (Solo si las opciones A y B fallan)

```bash
# Conectar directamente a la base de datos de producción
psql "postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres"

# Ejecutar el script
\i supabase/migrations/20251107000000_add_9na_category.sql
```

## 🛡️ Plan de Rollback

Si algo sale mal durante la migración en producción:

```sql
BEGIN;

-- Revertir scores de jugadores
UPDATE players
SET score = score - 300
WHERE score IS NOT NULL AND score >= 300;

-- Eliminar categoría 9na
DELETE FROM categories WHERE name = '9na';

-- Restaurar rangos originales de categorías
UPDATE categories SET lower_range = 600, upper_range = 899 WHERE name = '6ta';
UPDATE categories SET lower_range = 300, upper_range = 599 WHERE name = '7ma';
UPDATE categories SET lower_range = 0, upper_range = 299 WHERE name = '8va';

-- Recalcular category_name
UPDATE players
SET category_name = (
    SELECT name
    FROM categories
    WHERE players.score >= categories.lower_range
      AND (categories.upper_range IS NULL OR players.score <= categories.upper_range)
    ORDER BY lower_range DESC
    LIMIT 1
)
WHERE score IS NOT NULL;

COMMIT;
```

## 📁 Archivos Modificados

### Scripts SQL
- ✅ `add_9na_category.sql` - Script con verificaciones manuales (local)
- ✅ `add_9na_category_with_commit.sql` - Script con commit automático (local)
- ✅ `supabase/migrations/20251107000000_add_9na_category.sql` - Migración para producción

### Frontend
- ✅ `app/(main)/info/categorias/page.tsx` - Página de información de categorías
- ✅ `components/home/InfoSection.tsx` - Sección informativa del home

### Documentación
- ✅ `MIGRATION_9NA_CATEGORY.md` - Este documento

## ✅ Checklist de Producción

### Pre-Migración
- [ ] Todos los cambios commiteados y pusheados
- [ ] Build de producción exitoso
- [ ] Tests pasando (si aplica)
- [ ] Backup de base de datos creado
- [ ] Equipo notificado de la migración

### Durante la Migración
- [ ] Migración ejecutada en producción
- [ ] Sin errores en los logs
- [ ] Verificación de integridad pasada

### Post-Migración
- [ ] Categorías verificadas correctamente
- [ ] Jugadores en categorías correctas
- [ ] Frontend muestra información actualizada
- [ ] Tests de smoke pasando
- [ ] Monitoreo de errores en las próximas 24h

## 📝 Notas Adicionales

### Consideraciones Importantes
1. **No hay downtime esperado**: La migración es rápida (< 1 segundo para ~29-100 jugadores)
2. **Foreign Keys**: Las relaciones se mantienen gracias a `ON UPDATE CASCADE`
3. **Snapshots de ranking**: No requieren actualización porque referencian la categoría por nombre
4. **Torneos existentes**: No se ven afectados, mantienen su `category_name` actual

### Tablas Afectadas
- `categories` - Actualización de rangos + inserción de 9na
- `players` - Actualización de `score` y `category_name`

### Tablas NO Afectadas (pero relacionadas)
- `player_recategorizations` - Solo lectura, historial se mantiene
- `ranking_snapshots` - Solo lectura, snapshots históricos se mantienen
- `tournaments` - No se modifican, foreign key con CASCADE mantiene integridad

## 🔗 Referencias

- Tabla de categorías: `categories` (3 rows → 4 rows)
- Jugadores con score: 29 jugadores
- Distribución actual verificada en local exitosamente

---

**Fecha de creación:** 2025-11-07
**Autor:** Sistema de Migración Automática
**Estado:** ✅ Testing Local Completo | ⏳ Producción Pendiente
