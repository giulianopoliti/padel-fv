ALTER TABLE public.tournaments
ADD COLUMN IF NOT EXISTS enable_public_inscriptions boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS enable_payment_checkboxes boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS enable_transfer_proof boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS transfer_alias text,
ADD COLUMN IF NOT EXISTS transfer_amount numeric(10,2);

COMMENT ON COLUMN public.tournaments.enable_public_inscriptions IS
'Controls whether /tournaments/:id/inscriptions is publicly accessible.';

COMMENT ON COLUMN public.tournaments.enable_payment_checkboxes IS
'Enables manual payment tracking checkboxes for organizers.';

COMMENT ON COLUMN public.tournaments.enable_transfer_proof IS
'Enables bank transfer instructions and proof upload during couple registration.';

COMMENT ON COLUMN public.tournaments.transfer_alias IS
'Transfer alias displayed to players during registration when transfer proof is enabled.';

COMMENT ON COLUMN public.tournaments.transfer_amount IS
'Transfer amount required for the couple registration when transfer proof is enabled.';
