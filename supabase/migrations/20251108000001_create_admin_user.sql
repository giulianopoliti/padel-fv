-- ================================================================
-- CREAR USUARIO ADMIN EN SUPABASE AUTH + PUBLIC.USERS
-- ================================================================
-- IMPORTANTE:
-- 1. Cambiar 'admin@padel-cpa.com' por tu email deseado
-- 2. Cambiar el password por una contraseña fuerte
-- 3. Ejecutar SOLO UNA VEZ
-- 4. Esta migración requiere que 20251108000000_add_admin_role_to_enum.sql
--    haya sido ejecutada primero
-- ================================================================

DO $$
DECLARE
  new_user_id uuid;
  admin_email text := 'infocpa.padel@gmail.com'; -- CAMBIAR AQUÍ SI ES NECESARIO
  admin_password text := 'HugoCenturion+10'; -- CAMBIAR AQUÍ POR UNA CONTRASEÑA SEGURA
BEGIN
  -- Verificar si ya existe el usuario admin
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = admin_email) THEN
    RAISE NOTICE 'Usuario ADMIN ya existe con email: %', admin_email;

    -- Si existe, asegurarnos que tenga rol ADMIN en public.users
    UPDATE public.users
    SET role = 'ADMIN'
    WHERE email = admin_email;

    RAISE NOTICE 'Rol ADMIN actualizado para usuario existente';
    RETURN;
  END IF;

  -- Crear usuario en auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    admin_email,
    crypt(admin_password, gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  )
  RETURNING id INTO new_user_id;

  -- Crear registro en public.users con rol ADMIN
  -- Nota: Esto puede ser automático si tienes un trigger, sino lo incluimos manualmente
  INSERT INTO public.users (id, email, role, created_at)
  VALUES (new_user_id, admin_email, 'ADMIN', NOW())
  ON CONFLICT (id) DO UPDATE
  SET role = 'ADMIN';

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Usuario ADMIN creado exitosamente';
  RAISE NOTICE 'ID: %', new_user_id;
  RAISE NOTICE 'Email: %', admin_email;
  RAISE NOTICE 'Password: (el que configuraste en la migración)';
  RAISE NOTICE 'Puedes iniciar sesión en /admin-login';
  RAISE NOTICE '========================================';
END $$;
