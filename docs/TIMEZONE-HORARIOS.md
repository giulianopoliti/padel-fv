# Timezone y horarios

## Convencion general

Los horarios que representan un momento real del torneo se guardan como instantes UTC en la base de datos. En PostgreSQL/Supabase esto corresponde a columnas `timestamp with time zone`, como `tournaments.start_date` y `tournaments.end_date`.

Ejemplo:

- El organizador carga `20/05 22:00` en Argentina.
- El navegador construye ese horario como hora local.
- Antes de enviarlo, se serializa como ISO UTC.
- En la base queda algo equivalente a `2026-05-21T01:00:00.000Z`.
- Al mostrarlo al usuario, debe formatearse con `America/Argentina/Buenos_Aires` para verse como `20/05 22:00`.

Esta conversion es esperada: el valor UTC no significa que el torneo cambie de dia, solo es la representacion universal del mismo instante.

## Regla de render

Cuando se muestra fecha u hora de torneo al usuario, no hay que depender del timezone del servidor, del deploy o del dispositivo. El formateo debe fijar explicitamente:

```ts
timeZone: 'America/Argentina/Buenos_Aires'
```

Esto evita diferencias entre localhost y produccion. Por ejemplo, un server en UTC podria mostrar `21/05 01:00` si no se indica timezone, aunque el torneo haya sido cargado para Argentina como `20/05 22:00`.

## Fechas sin hora

Cuando el dato es una fecha pura, como una fecha de etapa o disponibilidad diaria, conviene tratarla como `YYYY-MM-DD` y no convertirla con `new Date(dateString)` si no hace falta. Para evitar corrimientos de dia, parsear sus partes manualmente o mantenerla como string.

## Resumen practico

- Guardar instantes reales como ISO UTC.
- Mostrar horarios de torneo con timezone explicito de Argentina.
- No cambiar datos existentes solo porque en la DB se vean en UTC.
- Evitar `toLocaleDateString` y `toLocaleTimeString` sin `timeZone` en vistas publicas de torneo.
