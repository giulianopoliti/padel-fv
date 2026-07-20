alter table if exists public.audit_logs
  drop constraint if exists audit_logs_user_id_fkey;

alter table if exists public.bracket_operations_log
  drop constraint if exists bracket_operations_log_user_id_fkey;

alter table if exists public.dni_conflicts
  drop constraint if exists dni_conflicts_new_user_id_fkey,
  drop constraint if exists dni_conflicts_resolved_by_fkey;

alter table if exists public.match_results_history
  drop constraint if exists match_results_history_user_id_fkey,
  drop constraint if exists match_results_history_reverted_by_fkey;

alter table if exists public.placeholder_resolutions
  drop constraint if exists placeholder_resolutions_resolved_by_fkey;

alter table if exists public.player_identity_transfers
  drop constraint if exists player_identity_transfers_transferred_user_id_fkey;

alter table if exists public.player_recategorizations
  drop constraint if exists player_recategorizations_recategorized_by_fkey;

comment on column public.audit_logs.user_id is
  'Historical actor UUID. Not constrained to public.users so deleted accounts do not break audit retention.';

comment on column public.player_identity_transfers.transferred_user_id is
  'Historical transferred account UUID. Not constrained to public.users so account resets can delete the Auth user while preserving audit.';
