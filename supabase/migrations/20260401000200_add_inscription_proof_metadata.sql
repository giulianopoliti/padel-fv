DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'payment_proof_status'
  ) THEN
    CREATE TYPE public.payment_proof_status AS ENUM (
      'NOT_REQUIRED',
      'PENDING_REVIEW',
      'APPROVED'
    );
  END IF;
END $$;

ALTER TABLE public.inscriptions
ADD COLUMN IF NOT EXISTS payment_proof_status public.payment_proof_status NOT NULL DEFAULT 'NOT_REQUIRED',
ADD COLUMN IF NOT EXISTS payment_proof_path text,
ADD COLUMN IF NOT EXISTS payment_proof_uploaded_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS payment_alias_snapshot text,
ADD COLUMN IF NOT EXISTS payment_amount_snapshot numeric(10,2),
ADD COLUMN IF NOT EXISTS payment_reviewed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS payment_reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inscriptions_payment_proof_status
ON public.inscriptions (payment_proof_status);

CREATE INDEX IF NOT EXISTS idx_inscriptions_payment_reviewed_by
ON public.inscriptions (payment_reviewed_by);

COMMENT ON COLUMN public.inscriptions.payment_proof_status IS
'Organizer review state for uploaded payment proof.';

COMMENT ON COLUMN public.inscriptions.payment_proof_path IS
'Private storage path for the uploaded payment proof.';

COMMENT ON COLUMN public.inscriptions.payment_alias_snapshot IS
'Alias snapshot shown to the player at registration time.';

COMMENT ON COLUMN public.inscriptions.payment_amount_snapshot IS
'Transfer amount snapshot shown to the player at registration time.';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'inscription-proofs',
  'inscription-proofs',
  false,
  10485760,
  ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO NOTHING;
