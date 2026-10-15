import { seedFromFile } from '../server/store.js';

const force = process.argv.includes('--force');

const result = await seedFromFile({ force });
if (result.seeded) {
  console.log('Neon app_snapshot seeded from data/db.json');
} else {
  console.log(`Seed skipped (${result.reason}). Use --force to overwrite.`);
}
