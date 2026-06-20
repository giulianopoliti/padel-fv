alter table public.tournaments
add column if not exists validate_inscriptions boolean not null default false;

comment on column public.tournaments.validate_inscriptions is
'When enabled, registrations created by players require organizer approval.';

-- Existing tournaments default to direct registration. Keep proof review independent.
update public.inscriptions
set is_pending = false
where is_pending = true;

create or replace function private.approve_pending_inscriptions_when_validation_disabled()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.validate_inscriptions = true and new.validate_inscriptions = false then
    update public.inscriptions
    set is_pending = false
    where tournament_id = new.id
      and is_pending = true;
  end if;

  return new;
end;
$$;

revoke all on function private.approve_pending_inscriptions_when_validation_disabled() from public;

drop trigger if exists approve_pending_inscriptions_when_validation_disabled
on public.tournaments;

create trigger approve_pending_inscriptions_when_validation_disabled
after update of validate_inscriptions on public.tournaments
for each row
execute function private.approve_pending_inscriptions_when_validation_disabled();
