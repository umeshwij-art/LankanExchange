// npm run eod [-- --force]
// Runs the end-of-day job from your machine (useful for the first load, or
// if Vercel's servers get blocked by cse.lk). Reads .env.local.
import { config } from 'dotenv';
import { runEndOfDay } from '../server/eod.js';

config({ path: '.env.local' });
config();

const force = process.argv.includes('--force');
runEndOfDay({ force })
  .then(r => {
    console.log(JSON.stringify(r, null, 2));
    process.exit(0);
  })
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
