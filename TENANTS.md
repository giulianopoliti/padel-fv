# Tenants y desarrollo local

Este repo usa el mismo codigo para `padel-fv` y `padel-elite`.

En produccion, cada proyecto de Vercel define sus propias variables de entorno. En local, usamos archivos separados por tenant para simular ese mismo comportamiento.

## Comandos locales

```bash
npm run dev:fv
npm run dev:elite
npm run build:fv
npm run build:elite
```

`npm run dev` sigue funcionando, pero no fuerza tenant. Para evitar diferencias raras con produccion, preferi siempre `dev:fv` o `dev:elite`.

## Archivos locales

Los archivos secretos locales son:

```txt
.env.padel-fv.local
.env.padel-elite.local
```

Estan ignorados por Git. Los ejemplos versionables son:

```txt
.env.padel-fv.example
.env.padel-elite.example
```

## Variables importantes

Cada tenant necesita:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
TENANT_ORGANIZATION_ID=
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_TENANT_ORGANIZATION_SLUG=
```

El script `scripts/with-tenant-env.mjs` agrega automaticamente:

```env
NEXT_PUBLIC_TENANT_KEY=padel-fv
```

o:

```env
NEXT_PUBLIC_TENANT_KEY=padel-elite
```

## Produccion

Por ahora no usamos Vercel Platforms.

El modelo recomendado es:

```txt
Vercel project padel-fv    -> mismo repo -> env FV    -> dominio padelfv.com
Vercel project padel-elite -> mismo repo -> env Elite -> dominio padelelite.com
```

En cada proyecto de Vercel, definir explicitamente `NEXT_PUBLIC_TENANT_KEY`, `NEXT_PUBLIC_SITE_URL`, `TENANT_ORGANIZATION_ID` y las credenciales Supabase correspondientes.
