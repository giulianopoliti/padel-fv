# 🔍 Fuzzy Search - Sistema de Búsqueda por Aproximación

Sistema de búsqueda inteligente que permite encontrar resultados incluso con errores de tipeo, diferentes formatos, o búsquedas parciales.

---

## 📋 Características

### ✅ Lo que puede hacer:

1. **Búsqueda insensible a mayúsculas/minúsculas**
   - `"ajuli"` encuentra `"AJuli"`
   - `"MARIA"` encuentra `"maría"`

2. **Tolerancia a acentos**
   - `"garcia"` encuentra `"García"`
   - `"jose"` encuentra `"José"`

3. **Búsqueda por palabras separadas**
   - `"ajuli ajuli"` encuentra `"AJuli AJuli"`
   - `"juan perez"` encuentra `"Juan Pérez"`
   - `"perez juan"` también encuentra `"Juan Pérez"` (orden no importa)

4. **Tolerancia a errores de tipeo (Levenshtein Distance)**
   - `"ajulli"` encuentra `"ajuli"` (1 letra extra)
   - `"juaan"` encuentra `"juan"` (1 letra duplicada)
   - `"mria"` encuentra `"maria"` (1 letra faltante)

5. **Búsqueda en múltiples campos**
   - Busca en nombre, apellido, DNI simultáneamente
   - Ponderación configurable (DNI puede tener más peso)

6. **Limpieza automática de espacios**
   - `"juan  perez"` (doble espacio) encuentra `"Juan Pérez"`
   - `" maria "` (espacios extra) encuentra `"María"`

---

## 🚀 Uso en TypeScript

### Búsqueda básica de jugadores

```typescript
import { searchPlayers } from '@/utils/fuzzy-search'

const players = [
  { id: '1', first_name: 'AJuli', last_name: 'AJuli', dni: '12345678' },
  { id: '2', first_name: 'María', last_name: 'García', dni: '87654321' },
  { id: '3', first_name: 'Juan', last_name: 'Pérez', dni: '11111111' }
]

// Búsqueda simple
const results = searchPlayers('ajuli ajuli', players)
// → Retorna: [{ id: '1', first_name: 'AJuli', ... }]

// Búsqueda con threshold personalizado
const results = searchPlayers('ajulli', players, 0.8)
// threshold más alto = más estricto
```

### Búsqueda avanzada

```typescript
import { fuzzySearch } from '@/utils/fuzzy-search'

const results = fuzzySearch('juan', players, {
  searchFields: ['first_name', 'last_name', 'dni'],
  threshold: 0.75, // 75% similitud mínima
  fieldWeights: {
    first_name: 2.0,  // Nombre tiene más peso
    last_name: 1.5,
    dni: 1.0
  },
  limit: 10 // Máximo 10 resultados
})

// results contiene:
// - item: el objeto encontrado
// - score: puntaje de similitud (0-1)
// - matchedFields: campos donde se encontró match
```

### Funciones auxiliares

```typescript
import { normalizeString, similarityScore } from '@/utils/fuzzy-search'

// Normalizar texto
normalizeString('  María García  ')
// → 'maria garcia'

// Calcular similitud
similarityScore('ajuli', 'ajulli')
// → 0.8 (80% similares)
```

---

## 🐍 Uso en Python

### Instalación

No requiere dependencias externas, solo Python 3.7+

```bash
# Copiar el archivo a tu proyecto
cp fuzzy_search.py /ruta/a/tu/proyecto/
```

### Búsqueda básica de jugadores

```python
from fuzzy_search import search_players

players = [
    {'id': '1', 'first_name': 'AJuli', 'last_name': 'AJuli', 'dni': '12345678'},
    {'id': '2', 'first_name': 'María', 'last_name': 'García', 'dni': '87654321'},
    {'id': '3', 'first_name': 'Juan', 'last_name': 'Pérez', 'dni': '11111111'}
]

# Búsqueda simple
results = search_players('ajuli ajuli', players)
# → Retorna: [{'id': '1', 'first_name': 'AJuli', ...}]

# Búsqueda con threshold personalizado
results = search_players('ajulli', players, threshold=0.8)
```

### Búsqueda avanzada

```python
from fuzzy_search import fuzzy_search

results = fuzzy_search(
    search_term='juan',
    items=players,
    search_fields=['first_name', 'last_name', 'dni'],
    threshold=0.75,
    field_weights={
        'first_name': 2.0,
        'last_name': 1.5,
        'dni': 1.0
    },
    limit=10
)

# results contiene objetos FuzzySearchResult:
for result in results:
    print(f"Score: {result.score}")
    print(f"Matched fields: {result.matched_fields}")
    print(f"Player: {result.item}")
```

### Funciones auxiliares

```python
from fuzzy_search import normalize_string, similarity_score

# Normalizar texto
normalize_string('  María García  ')
# → 'maria garcia'

# Calcular similitud
similarity_score('ajuli', 'ajulli')
# → 0.8 (80% similares)
```

### Ejecutar tests

```bash
python fuzzy_search.py
```

---

## 🧮 Algoritmos Implementados

### 1. Normalización de texto

Convierte texto a formato comparable:

```
"  María García  " → "maria garcia"
"JUAN  PÉREZ" → "juan perez"
"José Luis" → "jose luis"
```

**Operaciones:**
- Minúsculas
- Trim (eliminar espacios inicio/final)
- Comprimir espacios múltiples
- Remover acentos (NFD normalization)

### 2. Distancia de Levenshtein

Calcula cuántas ediciones se necesitan para transformar un string en otro.

```
levenshteinDistance("ajuli", "ajulli") = 1
  → Agregar una 'l'

levenshteinDistance("maria", "mario") = 1
  → Cambiar 'a' por 'o'

levenshteinDistance("juan", "juaan") = 1
  → Eliminar una 'a'
```

**Complejidad:** O(n × m) donde n y m son las longitudes de los strings

### 3. Score de Similitud

Normaliza la distancia de Levenshtein a un valor 0-1:

```
similarityScore = 1 - (distancia / maxLength)

similarityScore("ajuli", "ajuli") = 1.0   (idénticos)
similarityScore("ajuli", "ajulli") = 0.83 (muy similares)
similarityScore("ajuli", "maria") = 0.2   (muy diferentes)
```

### 4. Búsqueda Multi-Estrategia

Combina 3 estrategias de matching:

**Estrategia 1: Match exacto (normalizado)**
```typescript
"ajuli" in "ajuli garcia" → ✅ Match
```

**Estrategia 2: Match por palabras individuales**
```typescript
"ajuli ajuli" → ["ajuli", "ajuli"]
Buscar cada palabra en: "AJuli AJuli" → ["ajuli", "ajuli"]
Todas coinciden → ✅ Match
```

**Estrategia 3: Similitud global**
```typescript
similarityScore("ajulli", "ajuli") = 0.83
Si 0.83 >= threshold (0.75) → ✅ Match
```

---

## ⚙️ Configuración

### Threshold (Umbral de similitud)

Controla qué tan estricta es la búsqueda:

| Threshold | Descripción | Uso recomendado |
|-----------|-------------|------------------|
| `0.9` | Muy estricto | Solo typos mínimos |
| `0.8` | Estricto | 1-2 caracteres de diferencia |
| `0.75` | Moderado (default) | Balance ideal |
| `0.7` | Tolerante | Búsquedas más flexibles |
| `0.6` | Muy tolerante | Búsquedas amplias |

### Field Weights (Pesos de campos)

Controla la importancia de cada campo:

```typescript
// Búsqueda por nombre: priorizar first_name y last_name
fieldWeights: {
  first_name: 1.5,
  last_name: 1.5,
  dni: 1.0
}

// Búsqueda por DNI: priorizar dni
fieldWeights: {
  dni: 2.0,
  first_name: 1.0,
  last_name: 1.0
}
```

---

## 🎯 Casos de Uso Resueltos

### ✅ Problema original: "ajuli ajuli" → "AJuli AJuli"

**Antes:**
```typescript
"ajuli ajuli".includes("AJuli") → false ❌
```

**Ahora:**
```typescript
searchPlayers("ajuli ajuli", players)
→ Normaliza: "ajuli ajuli" y "ajuli ajuli"
→ Busca palabras: ["ajuli", "ajuli"] en ["ajuli", "ajuli"]
→ Match! ✅
```

### ✅ Búsqueda con typo: "ajulli" → "AJuli"

```typescript
searchPlayers("ajulli", players)
→ similarityScore("ajulli", "ajuli") = 0.83
→ 0.83 >= 0.7 threshold
→ Match! ✅
```

### ✅ Búsqueda sin acentos: "garcia" → "García"

```typescript
searchPlayers("garcia", players)
→ Normaliza: "garcia" y "garcia"
→ Match exacto! ✅
```

### ✅ Búsqueda con espacios extra: "juan  perez" → "Juan Pérez"

```typescript
searchPlayers("juan  perez", players)
→ Normaliza: "juan perez" y "juan perez"
→ Match exacto! ✅
```

### ✅ Búsqueda DNI parcial: "12345" → "12.345.678"

```typescript
searchPlayers("12345", players)
→ Limpia: "12345" y "12345678"
→ "12345" in "12345678"
→ Match! ✅
```

---

## 📊 Performance

### Complejidad computacional

- **Normalización:** O(n) por string
- **Levenshtein:** O(n × m) por comparación
- **Búsqueda total:** O(items × fields × palabras × n × m)

### Optimizaciones recomendadas para datasets grandes

1. **Limitar campos de búsqueda**
   ```typescript
   // Solo buscar en campos necesarios
   searchFields: ['first_name', 'last_name']
   ```

2. **Usar límite de resultados**
   ```typescript
   limit: 10 // Detener después de 10 matches
   ```

3. **Caché de normalizaciones**
   ```typescript
   // Pre-normalizar los players una sola vez
   const normalizedPlayers = players.map(p => ({
     ...p,
     _normalized: normalizeString(`${p.first_name} ${p.last_name}`)
   }))
   ```

4. **Backend search para datasets muy grandes (>10,000 items)**
   - Usar PostgreSQL con `pg_trgm` extension
   - Usar Elasticsearch
   - Usar Algolia/MeiliSearch

---

## 🧪 Tests

### TypeScript

```bash
# Agregar a tu test suite
npm run test -- fuzzy-search.test.ts
```

### Python

```bash
# Ejecutar tests integrados
python fuzzy_search.py

# Output esperado:
# ✅ Test 1: 'ajuli ajuli' → 1 resultado
# ✅ Test 2: 'ajulli' → 1 resultado
# ✅ Test 3: DNI '12345678' → 1 resultado
# ✅ Test 4: 'jul' → 2 resultados
# ✅ Test 5: 'maria garcia' → 1 resultado
```

---

## 🔧 Troubleshooting

### Problema: "No encuentra nada"

**Solución 1:** Bajar el threshold
```typescript
searchPlayers('term', players, 0.6) // Más tolerante
```

**Solución 2:** Verificar normalización
```typescript
console.log(normalizeString(searchTerm))
console.log(normalizeString(player.first_name))
```

### Problema: "Encuentra demasiados resultados irrelevantes"

**Solución 1:** Subir el threshold
```typescript
searchPlayers('term', players, 0.85) // Más estricto
```

**Solución 2:** Aumentar mínimo de caracteres
```typescript
// En el schema de validación
z.string().min(4, 'Mínimo 4 caracteres')
```

### Problema: "Búsqueda muy lenta"

**Solución 1:** Limitar resultados
```typescript
fuzzySearch(term, players, { ..., limit: 20 })
```

**Solución 2:** Reducir campos de búsqueda
```typescript
searchFields: ['first_name', 'last_name'] // Sin DNI
```

**Solución 3:** Mover a backend
- Implementar API endpoint con fuzzy_search.py
- Usar índices en base de datos

---

## 📚 Referencias

- [Levenshtein Distance - Wikipedia](https://en.wikipedia.org/wiki/Levenshtein_distance)
- [Unicode Normalization - MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize)
- [Fuzzy String Matching - Blog Post](https://www.cs.cmu.edu/~wcohen/10-605/notes/fuzzy-matching.pdf)

---

## 📝 TODO / Mejoras Futuras

- [ ] Implementar búsqueda fonética (Soundex, Metaphone)
- [ ] Caché de resultados de búsqueda
- [ ] Highlighting de matches en UI
- [ ] Búsqueda incremental (auto-complete)
- [ ] Integración con base de datos (PostgreSQL `pg_trgm`)
- [ ] Búsqueda por similitud de sonido (para nombres latinos)

---

## 👥 Contribuciones

Para agregar nuevas estrategias de búsqueda o mejorar el algoritmo, editar:
- TypeScript: `utils/fuzzy-search.ts`
- Python: `utils/fuzzy_search.py`
- Tests: Agregar en cada archivo
- Docs: Actualizar este README

---

## 📄 Licencia

Este código es parte del proyecto Padel Tournament System.
Úsalo libremente en tus proyectos.
