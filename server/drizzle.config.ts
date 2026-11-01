import { defineConfig } from 'drizzle-kit';

/**
 * drizzle-kit config (schema generation / migration authoring).
 * `npm run db:generate` writes SQL migrations into ./drizzle, which the server
 * applies on boot via src/db/migrate.ts.
 */
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url:
      process.env.DATABASE_URL ||
      'postgres://choresrewards:choresrewards@127.0.0.1:55432/choresrewards',
  },
  verbose: true,
  strict: false,
});
