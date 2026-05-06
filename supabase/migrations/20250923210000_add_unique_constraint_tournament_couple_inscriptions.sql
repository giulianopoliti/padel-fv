-- Agregar constraint único para prevenir inscripciones duplicadas
-- Una pareja no puede inscribirse múltiples veces en el mismo torneo

-- Primero limpiar cualquier duplicado existente (manteniendo el más reciente)
DELETE FROM inscriptions
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (PARTITION BY tournament_id, couple_id ORDER BY created_at DESC) as rn
    FROM inscriptions
    WHERE couple_id IS NOT NULL
  ) ranked
  WHERE rn > 1
);

-- Ahora agregar el constraint único
ALTER TABLE inscriptions
ADD CONSTRAINT unique_tournament_couple_inscription
UNIQUE (tournament_id, couple_id);

-- Comentario: Este constraint previene que la misma pareja se inscriba múltiples veces en el mismo torneo
-- Esto resuelve el problema de claves duplicadas en React al mostrar las matrices de resultados