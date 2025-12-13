-- Drop ULID column from users table if it exists
ALTER TABLE "Users" DROP COLUMN IF EXISTS ulid;