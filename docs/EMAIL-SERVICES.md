# Email services

El proyecto usa dos caminos de email:

- Supabase Auth + Resend SMTP para emails de autenticacion: recovery, confirmacion, magic links.
- Servicio interno Resend API para emails transaccionales de negocio: solicitudes/confirmaciones de inscripcion y partidos programados.

## Supabase Auth

Configurar en cada proyecto Supabase, en Authentication > Email > SMTP Settings:

```txt
Host: smtp.resend.com
Port: 465
Username: resend
Password: RESEND_API_KEY
Sender email: no-reply@auth.<dominio>
Sender name: nombre de marca
```

Cada tenant debe tener su propio Site URL y Redirect URLs:

```txt
https://padelfv.com/auth/callback
https://padelfv.com/auth/callback/recovery
https://tpepadel.com/auth/callback
https://tpepadel.com/auth/callback/recovery
```

En cada Supabase se cargan solo los redirects del dominio de ese tenant, mas localhost si se usa para pruebas.

## Vercel

Variables requeridas por proyecto Vercel:

```env
NEXT_PUBLIC_TENANT_KEY=padel-elite
NEXT_PUBLIC_SITE_URL=https://tpepadel.com
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
TENANT_ORGANIZATION_ID=
TENANT_ORGANIZATION_SLUG=padel-elite
NEXT_PUBLIC_TENANT_ORGANIZATION_SLUG=padel-elite
RESEND_API_KEY=
EMAIL_FROM="TPE Padel <no-reply@auth.tpepadel.com>"
EMAIL_REPLY_TO=tpepadel@gmail.com
EMAIL_ENABLED=true
```

Para FV cambiar tenant, dominio, Supabase y sender.

## Comportamiento

- Si faltan `RESEND_API_KEY` o `EMAIL_FROM`, el envio se saltea y queda logueado.
- Si Resend falla, la inscripcion o creacion de partido no se revierte.
- Los emails se envian solo a jugadores con `players.user_id` vinculado a `users.email`.
- Las inscripciones pendientes envian un email de solicitud recibida y, al aprobarse, otro de confirmacion.
- Los partidos en estado `DRAFT` no notifican.
- Los partidos sin fecha y hora no notifican.

## Siguientes mejoras

- Crear una tabla `email_events` para auditoria/reintentos.
- Agregar email cuando se modifica o cancela un partido ya programado.
