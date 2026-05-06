Eres un ingeniero senior full-stack experto en Next.js 14 (App Router), Supabase (Auth Helpers v2) y TypeScript.  
El repositorio es un monorepo “padel-tournament-system” alojado en Git con la siguiente estructura abreviada:

  app/(main)/layout.tsx
  components/supabase-provider.tsx
  contexts/user-context.tsx
  utils/supabase/client.ts      ← createBrowserClient
  utils/supabase/server.ts      ← createServerClient
  utils/supabase/middleware.ts  ← auth + permisos
  …

Objetivo de la feature
----------------------
1. Mover **toda** la lógica de obtención de detalles del usuario —rol y ID del rol— del *cliente* (UserProvider) al *servidor* (RSC/layout), para evitar latencias y los time-outs actuales.
2. Exponer esos datos al cliente como `initialUserDetails` para que la UI pueda hidratarse sin consultas extra.
3. Eliminar los `Promise.race` con `setTimeout` del `UserProvider`.
4. Mantener un método `refreshUserDetails()` para futuros updates desde el cliente.
5. Mantener compatibilidad con los 3 roles existentes: `PLAYER`, `CLUB`, `COACH`.  (El rol `ADMIN` todavía no requiere lógica adicional).

Guías y convenciones del proyecto
---------------------------------
- TypeScript estricto, ESLint y Prettier activos.
- Estilos con Tailwind y componentes Shadcn.
- Nombres de funciones const = () => {}, prefijos `handle` para eventos.
- Early returns para legibilidad.
- No dejar TODOs ni comentarios de código muerto.
- DRY: factorizar lógica común.
- Directorios/archivos a modificar o crear:
    • `utils/db/getUserDetails.ts`           (nuevo, server-only)
    • `app/(main)/layout.tsx`               (modificar)
    • `contexts/user-context.tsx`           (modificar grande)
    • `types/index.ts` (agregar tipo `DetailedUserDetails` global)
    • SQL opcional: `supabase/migrations/<timestamp>_create_user_details_view.sql`

Pasos a implementar
===================

1.  **SQL (opcional pero recomendado)**  
    Crear una *view* o función RPC en Supabase llamada `user_details_v` que devuelva en una sola fila:
    ```
    id, email, role, avatar_url,
    player_id, club_id, coach_id
    ```
    Ejemplo de view:
    ```sql
    create or replace view public.user_details_v as
    select
      u.id,
      u.email,
      u.role,
      u.avatar_url,
      p.id   as player_id,
      c.id   as club_id,
      co.id  as coach_id
    from public.users u
    left join public.players  p  on p.user_id  = u.id
    left join public.clubes   c  on c.user_id  = u.id
    left join public.coaches  co on co.user_id = u.id;
    ```
    Incluye un archivo de migración:  
    `supabase/migrations/20250711_create_user_details_view.sql`.

2.  **Nuevo helper server-side** – `utils/db/getUserDetails.ts`  
    ```ts
    "use server"
    import { createClient } from "@/utils/supabase/server";
    import type { DetailedUserDetails } from "@/types";

    export async function getUserDetails(): Promise<DetailedUserDetails | null> {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("user_details_v")   // o .rpc("get_user_details")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data as DetailedUserDetails;
    }
    ```

3.  **Actualizar `types/index.ts`**  
    ```ts
    export interface DetailedUserDetails extends DbUserType {
      player_id?: string | null;
      club_id?: string | null;
      coach_id?: string | null;
    }
    ```

4.  **Modificar `app/(main)/layout.tsx`**  
    Dentro de la función  `MainLayout`:
    ```tsx
    import { getUserDetails } from "@/utils/db/getUserDetails";

    // después de obtener `user`:
    const initialUserDetails =
      user ? await getUserDetails() : null;
    
    return (
      <SupabaseProvider initialUser={user}>
        <ThemeProvider …>
          <UserProvider initialUserDetails={initialUserDetails}>
            …
    ```

5.  **Refactorizar `contexts/user-context.tsx`**  
    a.  Cambiar la firma del provider:  
    `export function UserProvider({ children, initialUserDetails }: { children: ReactNode; initialUserDetails: DetailedUserDetails | null })`
    b.  El estado inicial `userDetails` se hidrata con `initialUserDetails`.  
    c.  Eliminar **por completo** los bloques de `Promise.race` + `setTimeout`.  
    d.  Conservar sólo un método:
    ```ts
    const refreshUserDetails = useCallback(async () => {
      if (!user) return;
      setLoading(true);
      setError(null);
      try {
        const latest = await fetch("/api/user/refresh").then(r => r.json()); // o llamar getUserDetails vía action
        setUserDetails(latest);
      } catch (e) {
        setError("No se pudo actualizar tus datos.");
      } finally {
        setLoading(false);
      }
    }, [user]);
    ```
    e.  Exportar el hook `useUser` con `{ user, userDetails, loading, refreshUserDetails, logout, error }`.

6.  **QA Manual**  
    - Login con cada rol y comprobar que la página llega ya con datos (sin flashes de loading en Navbar).  
    - Hacer hard refresh; capturar en DevTools → “Network” que NO existe llamada `/rest/v1/users` ni `/rest/v1/players` desde el cliente.  
    - Simular conexión lenta (~400 ms TTLB) y validar que no hay time-outs.

7.  **Tests**  
    - Unit test simple en Jest para `getUserDetails` con mocking de Supabase client.  
    - Test e2e (Playwright) : usuario club inactivo redirige a `/pending-approval` (middleware ya lo hace).

Restricciones
-------------
- Mantener compatibilidad con Supabase Auth Helpers v2.
- No tocar `utils/supabase/middleware.ts`.
- No introducir dependencias nuevas salvo `p-timeout` si decides usarlo en el helper (máx 25 s).
- Cumplir ESLint (`pnpm lint`) y las reglas del proyecto.

Output requerido
----------------
Devuelve **exclusivamente** los cambios de código usando diff patch por archivo, sin explicaciones extra, por ejemplo:

```diff
// utils/db/getUserDetails.ts
+ …nuevo contenido…

// app/(main)/layout.tsx
@@
- const initialUser = …
+ const initialUserDetails = …
+ …
```

No escribas markdown, solo los bloques de diff.

Fin.