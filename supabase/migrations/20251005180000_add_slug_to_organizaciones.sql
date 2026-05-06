-- Add slug column to organizaciones table
ALTER TABLE organizaciones
ADD COLUMN slug VARCHAR(100) UNIQUE;

-- Create index for faster slug lookups
CREATE INDEX idx_organizaciones_slug ON organizaciones(slug);

-- Function to generate slug from name
CREATE OR REPLACE FUNCTION generate_slug(text_input TEXT)
RETURNS TEXT AS $$
DECLARE
  slug TEXT;
BEGIN
  -- Convert to lowercase, replace spaces with hyphens, remove special characters
  slug := lower(trim(text_input));
  slug := regexp_replace(slug, '[^a-z0-9\s-]', '', 'g'); -- Remove special chars except spaces and hyphens
  slug := regexp_replace(slug, '\s+', '-', 'g'); -- Replace spaces with hyphens
  slug := regexp_replace(slug, '-+', '-', 'g'); -- Replace multiple hyphens with single hyphen
  slug := trim(both '-' from slug); -- Remove leading/trailing hyphens

  RETURN slug;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to ensure unique slug
CREATE OR REPLACE FUNCTION ensure_unique_slug(base_slug TEXT, org_id UUID DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
  final_slug TEXT;
  counter INT := 1;
  slug_exists BOOLEAN;
BEGIN
  final_slug := base_slug;

  LOOP
    -- Check if slug exists (excluding current organization if updating)
    SELECT EXISTS (
      SELECT 1 FROM organizaciones
      WHERE slug = final_slug
      AND (org_id IS NULL OR id != org_id)
    ) INTO slug_exists;

    EXIT WHEN NOT slug_exists;

    -- If slug exists, append counter
    final_slug := base_slug || '-' || counter;
    counter := counter + 1;
  END LOOP;

  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to auto-generate and update slug
CREATE OR REPLACE FUNCTION auto_generate_slug()
RETURNS TRIGGER AS $$
DECLARE
  base_slug TEXT;
BEGIN
  -- Only generate slug if name is provided and (slug is null OR name has changed)
  IF NEW.name IS NOT NULL AND (NEW.slug IS NULL OR (TG_OP = 'UPDATE' AND OLD.name != NEW.name)) THEN
    base_slug := generate_slug(NEW.name);
    NEW.slug := ensure_unique_slug(base_slug, NEW.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on INSERT and UPDATE
CREATE TRIGGER trigger_auto_generate_slug
  BEFORE INSERT OR UPDATE ON organizaciones
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_slug();

-- Backfill existing organizations with slugs
UPDATE organizaciones
SET slug = ensure_unique_slug(generate_slug(name), id)
WHERE name IS NOT NULL AND slug IS NULL;

-- Make slug NOT NULL after backfilling
ALTER TABLE organizaciones
ALTER COLUMN slug SET NOT NULL;

-- Add comment
COMMENT ON COLUMN organizaciones.slug IS 'URL-friendly unique identifier generated from organization name. Used for public profile URLs like /organizations/eventos-fv';
