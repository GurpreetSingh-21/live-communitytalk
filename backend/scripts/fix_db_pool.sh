#!/bin/bash
# Quick fix for database connection pool exhaustion

echo "🔧 Fixing database connection pool..."

# Add connection pool parameters to DATABASE_URL if not already present
# Postgres connection string format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE?connection_limit=50&pool_timeout=20

echo "
📝 Add these parameters to your DATABASE_URL in .env:

?connection_limit=50&pool_timeout=20&connect_timeout=30

Example:
DATABASE_URL=postgresql://user:pass@host:5432/db?connection_limit=50&pool_timeout=20
"

# Run migration to add indexes
cd /Users/jascharansingh/Projects/live-communitytalk/backend
npx prisma migrate dev --name add_dm_indexes --create-only

echo "
✅ Migration created. Review it, then run:
   npx prisma migrate deploy
"
