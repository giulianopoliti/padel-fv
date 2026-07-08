ALTER TABLE "public"."clubes"
ADD COLUMN IF NOT EXISTS "google_place_id" "text",
ADD COLUMN IF NOT EXISTS "formatted_address" "text",
ADD COLUMN IF NOT EXISTS "latitude" double precision,
ADD COLUMN IF NOT EXISTS "longitude" double precision,
ADD COLUMN IF NOT EXISTS "maps_url" "text",
ADD COLUMN IF NOT EXISTS "location_verified_at" timestamp with time zone;

CREATE INDEX IF NOT EXISTS "idx_clubes_google_place_id"
ON "public"."clubes" ("google_place_id")
WHERE "google_place_id" IS NOT NULL;

COMMENT ON COLUMN "public"."clubes"."google_place_id" IS 'Google Places identifier for precise Google Maps linking.';
COMMENT ON COLUMN "public"."clubes"."formatted_address" IS 'Address returned by Google Places or curated by the club.';
COMMENT ON COLUMN "public"."clubes"."latitude" IS 'Latitude for the verified club location.';
COMMENT ON COLUMN "public"."clubes"."longitude" IS 'Longitude for the verified club location.';
COMMENT ON COLUMN "public"."clubes"."maps_url" IS 'Optional curated Google Maps URL for the club.';
COMMENT ON COLUMN "public"."clubes"."location_verified_at" IS 'Timestamp when the club location was verified with Google Places.';
