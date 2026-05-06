-- Create fecha_status enum
CREATE TYPE "public"."fecha_status" AS ENUM (
    'NOT_STARTED',
    'SCHEDULING', 
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELED'
);