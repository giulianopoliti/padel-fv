create table if not exists public.player_identity_transfers (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null unique,
  source_player_id uuid not null references public.players(id),
  target_player_id uuid not null references public.players(id),
  transferred_user_id uuid not null references public.users(id),
  organization_id uuid not null references public.organizaciones(id),
  performed_by uuid not null references public.users(id),
  reason text not null,
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'rolled_back', 'recovery_required')),
  source_snapshot jsonb not null,
  target_snapshot jsonb not null,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists player_identity_transfers_organization_created_idx
  on public.player_identity_transfers (organization_id, created_at desc);

create index if not exists player_identity_transfers_user_idx
  on public.player_identity_transfers (transferred_user_id);

alter table public.player_identity_transfers enable row level security;

revoke all on table public.player_identity_transfers from anon, authenticated;
grant all on table public.player_identity_transfers to service_role;

comment on table public.player_identity_transfers is
  'Audit trail for organizer-initiated player identity transfers. Access is server-only.';
