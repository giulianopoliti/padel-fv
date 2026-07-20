create table if not exists public.player_user_account_resets (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null unique,
  player_id uuid not null references public.players(id),
  deleted_user_id uuid not null,
  deleted_email text,
  organization_id uuid,
  performed_by uuid,
  reason text not null,
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'failed', 'recovery_required')),
  player_snapshot jsonb not null,
  user_snapshot jsonb not null,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists player_user_account_resets_player_created_idx
  on public.player_user_account_resets (player_id, created_at desc);

create index if not exists player_user_account_resets_deleted_user_idx
  on public.player_user_account_resets (deleted_user_id);

create index if not exists player_user_account_resets_organization_created_idx
  on public.player_user_account_resets (organization_id, created_at desc);

alter table public.player_user_account_resets enable row level security;

revoke all on table public.player_user_account_resets from anon, authenticated;
grant all on table public.player_user_account_resets to service_role;

comment on table public.player_user_account_resets is
  'Server-only audit trail for account resets that unlink a player from a deleted Supabase Auth user.';
