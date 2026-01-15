-- Test migration to verify Virginia Supabase connection
CREATE TABLE IF NOT EXISTS "test_connection" (
  "id" SERIAL PRIMARY KEY,
  "created_at" TIMESTAMP DEFAULT NOW()
);
