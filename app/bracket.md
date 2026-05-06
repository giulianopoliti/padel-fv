Estoy desarrollando una aplicación para gestionar torneos de pádel con Next.js y Supabase.

Quiero que me ayudes a generar un algoritmo limpio, escalable y reutilizable en TypeScript que sirva para crear los brackets eliminatorios (cuadro final) a partir de parejas clasificadas en zonas.

✔️ Requisitos:
Entrada: una lista de parejas con estos datos:

id

zona (ej. 'A', 'B', 'C', etc.)

puntos obtenidos en la zona

posicionEnZona (1 para primeros, 2 para segundos, etc.)

Proceso:

Agrupar por posición (todos los primeros juntos, segundos juntos, etc.).

Dentro de cada posición, ordenar por orden de zona (A < B < C...) y luego por puntos si hace falta.

Asignar un número de seed global a cada pareja (1, 2, 3...).

Generar un bracket (cuadro de eliminación directa) con el siguiente criterio:

seed 1 vs seed N

seed 2 vs seed N-1

y así sucesivamente.

Si el total de parejas no es potencia de 2, completar con BYEs para escalar correctamente (por ejemplo, 21 → escalar a 32).

Salida esperada:

Un array de BracketMatch, cada uno con:

pareja1, pareja2 (ambos con su seed)

Quiero que mires todo el codigo, frontend y backend. Y también que tengas en cuenta las tablas como tournament_couple_seeds de supabase, podes verlas via MCP, y si hace falta agregar algun campo a alguna tabla como matches, tambien quiero que lo sugieras. Porque no se estan generando bien los partidos. 
Quiero que seas extremadamente claro.