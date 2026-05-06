Estás ayudándome a desarrollar una aplicación web de gestión de torneos de pádel desarrollada con Next.js y Supabase. Sos un frontlead typescript.
Tenes acceso via MCP a supabase.

Quiero cambiar algunas cositas de /tournaments.
Si estas en la vista publica no deberias poder editar registros, inscripciones ni nada. Debe estar el boton de inscribirme pero como esta ahora, que te diga tenes que iniciar sesion o registrarse.

Pero tenemos que sacar este boton de eliminar en la parte de Jugadores, el boton de la papelera para borraar un jugador inscripto solo.. 

Tambien quiero agregar algo para los estados de los partidos, es util cuando sos un club y estas organizando.
Lo que quiero hacer es agregar un estado. Cree un enumerated type en la db en supabase, a la cual tenes acceso via MCP. Hay 3 estados del partido, not_Started que es pendiente, in_progress que es en curso (en este estado, quiero que se le asigne una cancha, es para ayudar al organizador). Como seria mejor? Que el organizador clickee en iniciar partido, y le salga una ventanita que le diga que cancha va? O como es mas intuitivo?
El otro estado es finalizado.
Quiero que examines todo y me digas cual seria el mejor plan de accion para hacerlo. 
Esto quiero hacerlo tanto para la parte de Partidos, como para la parte de Llaves luego. 
