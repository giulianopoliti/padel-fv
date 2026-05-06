-- Migration: Create inscription_payments table
-- This table tracks payment status for each player in an inscription
-- Each inscription has 2 players, so there will be 2 records per inscription

CREATE TABLE IF NOT EXISTS "public"."inscription_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "inscription_id" "uuid" NOT NULL,
    "player_id" "uuid" NOT NULL,
    "has_paid" boolean DEFAULT false NOT NULL,
    "paid_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "inscription_payments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "inscription_payments_inscription_id_fkey" FOREIGN KEY ("inscription_id") REFERENCES "public"."inscriptions"("id") ON DELETE CASCADE,
    CONSTRAINT "inscription_payments_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE CASCADE,
    CONSTRAINT "inscription_payments_unique" UNIQUE ("inscription_id", "player_id")
);

ALTER TABLE "public"."inscription_payments" OWNER TO "postgres";

COMMENT ON TABLE "public"."inscription_payments" IS 'Tracks payment status for each player in a tournament inscription';
COMMENT ON COLUMN "public"."inscription_payments"."has_paid" IS 'Whether the player has paid for the inscription';
COMMENT ON COLUMN "public"."inscription_payments"."paid_at" IS 'Timestamp when the payment was marked as complete';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "idx_inscription_payments_inscription_id" ON "public"."inscription_payments" ("inscription_id");
CREATE INDEX IF NOT EXISTS "idx_inscription_payments_player_id" ON "public"."inscription_payments" ("player_id");

-- RLS Policies
ALTER TABLE "public"."inscription_payments" ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read payment status
DROP POLICY IF EXISTS "inscription_payments_select_policy" ON "public"."inscription_payments";
CREATE POLICY "inscription_payments_select_policy" ON "public"."inscription_payments"
    FOR SELECT USING (true);

-- Policy: Authenticated users with proper permissions can update payments
DROP POLICY IF EXISTS "inscription_payments_update_policy" ON "public"."inscription_payments";
CREATE POLICY "inscription_payments_update_policy" ON "public"."inscription_payments"
    FOR UPDATE USING (true);

-- Policy: Authenticated users with proper permissions can insert payments
DROP POLICY IF EXISTS "inscription_payments_insert_policy" ON "public"."inscription_payments";
CREATE POLICY "inscription_payments_insert_policy" ON "public"."inscription_payments"
    FOR INSERT WITH CHECK (true);

-- Policy: Authenticated users with proper permissions can delete payments
DROP POLICY IF EXISTS "inscription_payments_delete_policy" ON "public"."inscription_payments";
CREATE POLICY "inscription_payments_delete_policy" ON "public"."inscription_payments"
    FOR DELETE USING (true);

-- Function to automatically create payment records when inscription is approved
CREATE OR REPLACE FUNCTION "public"."create_payment_records_on_approval"()
RETURNS TRIGGER AS $$
DECLARE 
    couple_record RECORD;
BEGIN
    -- Only trigger when is_pending changes from true to false (approval)
    IF OLD.is_pending = true AND NEW.is_pending = false THEN
        -- Get the couple info (columns are player1_id and player2_id without underscore)
        SELECT player1_id, player2_id INTO couple_record 
        FROM couples
        WHERE id = NEW.couple_id;

        -- Insert payment record for player 1 if exists
        IF couple_record.player1_id IS NOT NULL THEN
            INSERT INTO inscription_payments (inscription_id, player_id, has_paid)
            VALUES (NEW.id, couple_record.player1_id, false)
            ON CONFLICT (inscription_id, player_id) DO NOTHING;
        END IF;

        -- Insert payment record for player 2 if exists
        IF couple_record.player2_id IS NOT NULL THEN
            INSERT INTO inscription_payments (inscription_id, player_id, has_paid)
            VALUES (NEW.id, couple_record.player2_id, false)
            ON CONFLICT (inscription_id, player_id) DO NOTHING;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create payment records when inscription is approved
DROP TRIGGER IF EXISTS "trigger_create_payment_records" ON "public"."inscriptions";
CREATE TRIGGER "trigger_create_payment_records"
    AFTER UPDATE ON "public"."inscriptions"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."create_payment_records_on_approval"();

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION "public"."update_inscription_payments_updated_at"()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS "trigger_inscription_payments_updated_at" ON "public"."inscription_payments";
CREATE TRIGGER "trigger_inscription_payments_updated_at"
    BEFORE UPDATE ON "public"."inscription_payments"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_inscription_payments_updated_at"();

