# Scripts SQL para Datos de Prueba

## Crear 42 Jugadores de Prueba

Ejecutar en el SQL Editor de Supabase:

```sql
-- Copiar y pegar el contenido de create-test-players.sql
```

Este script creará:
- 42 jugadores con nombres ficticios argentinos
- DNIs falsos que comienzan con "99" para identificarlos fácilmente
- Campo `es_prueba = true` para distinguirlos de jugadores reales
- Sin categorizar (sin `category_name`)
- Scores aleatorios entre 560-850 puntos

## Limpiar Datos de Prueba

⚠️ **CUIDADO**: Solo ejecutar cuando quieras eliminar TODOS los datos de prueba

```sql
-- Copiar y pegar el contenido de cleanup-test-data.sql
```

Este script eliminará TODOS los registros con `es_prueba = true` de todas las tablas.

## Características de los Datos de Prueba

- **DNIs**: Formato `99XXXXXX` (fácil identificación)
- **Teléfonos**: Formato `011XXXXXXX` (Buenos Aires)
- **Nombres**: Combinaciones realistas de nombres argentinos
- **Preferencias**: Mix de DRIVE/REVES y mano derecha/izquierda
- **Scores**: Variedad de niveles para pruebas realistas

## Inscribir Todos los Jugadores de Prueba a un Torneo

Para inscribir masivamente todos los jugadores de prueba a un torneo específico:

```sql
-- Copiar y pegar el contenido de register-test-players-to-tournament.sql
```

Este script:
- Inscribe TODOS los jugadores con `es_prueba = true` al torneo
- Evita duplicados (no inscribe si ya están inscritos)
- Marca las inscripciones con `es_prueba = true`
- Muestra cuántos jugadores se inscribieron

## Des-inscribir Jugadores de Prueba de un Torneo

⚠️ **SOLO para limpiar después de las pruebas**:

```sql
-- Copiar y pegar el contenido de unregister-test-players-from-tournament.sql
```

## Próximos Pasos

1. Crear jugadores de prueba ✅
2. Inscribirlos masivamente al torneo ✅
3. Crear parejas manualmente o con script adicional
4. Probar lógica de zonas y partidos 