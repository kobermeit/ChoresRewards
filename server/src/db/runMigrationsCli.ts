import { runMigrations } from './migrate';
import { closePool } from './client';

/** CLI entry: `npm --prefix server run db:migrate` */
runMigrations()
  .then(async () => {
    await closePool();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('[db] Migration failed:', err);
    await closePool();
    process.exit(1);
  });
