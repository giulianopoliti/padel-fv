-- Add responsible person fields to organizaciones table
ALTER TABLE organizaciones 
ADD COLUMN responsible_first_name TEXT,
ADD COLUMN responsible_last_name TEXT, 
ADD COLUMN responsible_dni TEXT,
ADD COLUMN responsible_position TEXT;