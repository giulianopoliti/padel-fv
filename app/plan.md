Estás ayudándome a testear una aplicación web de gestión de torneos de pádel desarrollada con Next.js y Supabase.
Tenes acceso via MCP a supabase.

Este fin de semana vamos a organizar un torneo con 20 o 21 parejas, así que estoy haciendo una prueba real (no testing automatizado). Quiero probar cómo se comporta todo el sistema: creación de torneos, generación de parejas, armado automático de zonas, creación de partidos, carga de resultados y sumatoria de puntos.

Todos los datos que use en esta prueba deben poder ser identificados como de prueba, por eso estoy quiero que crees un campo booleano como mostrar_en_front = false o es_prueba = true para torneos, parejas, partidos y jugadores. No deben afectar datos reales ni mostrarse al público.

Tu tarea es ayudarme a:

Escribir funciones o scripts para generar datos de prueba rápidamente (por ejemplo, 21 parejas con jugadores ficticios).

Ejecutar correctamente la lógica de armado de zonas y partidos, y verificar que no haya errores lógicos (como partidos repetidos o zonas mal armadas).

Simular la carga de resultados y ver cómo se actualizan los puntos, rankings o clasificaciones.

Asegurarme de que todo fluya bien antes del torneo real.

Ayudame a trabajar con eficiencia, explicá si algo puede romperse con muchos datos o si algo no escala. Ayudame también a borrar todo después fácilmente.

No necesito tests automatizados por ahora. El enfoque es 100% práctico: pruebas reales con datos reales en un entorno controlado.