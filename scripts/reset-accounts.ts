// npm run reset-accounts -- --confirm
//
// One-off cleanup for the move to the new trading engine:
//  • resets every user to a fresh LKR 100,000 account (positions, orders
//    and trade history under users/{uid} are deleted)
//  • deletes the old top-level trades / positions / orders collections
//  • clears the leaderboard
// Users who sign in before you run this are reset automatically anyway;
// this script removes the leftover legacy data. It cannot be undone.
import { config } from 'dotenv';
import { db } from '../server/firebaseAdmin.js';
import { publicName, SCHEMA_VERSION } from '../server/accounts.js';
import { STARTING_CASH } from '../shared/fees.js';

config({ path: '.env.local' });
config();

async function main() {
  if (!process.argv.includes('--confirm')) {
    console.log('This permanently resets every account. Re-run with --confirm to proceed.');
    return;
  }
  const firestore = db();

  for (const name of ['trades', 'positions', 'orders', 'leaderboard']) {
    await firestore.recursiveDelete(firestore.collection(name));
    console.log(`Deleted collection ${name}/`);
  }

  const users = await firestore.collection('users').get();
  for (const u of users.docs) {
    for (const sub of ['positions', 'orders', 'trades']) await firestore.recursiveDelete(u.ref.collection(sub));
    await u.ref.set({
      uid: u.id,
      displayName: publicName(u.get('displayName')),
      photoURL: u.get('photoURL') ?? null,
      startingCash: STARTING_CASH,
      cash: STARTING_CASH,
      reservedCash: 0,
      realizedPL: 0,
      openOrderCount: 0,
      createdAt: new Date().toISOString(),
      schemaVersion: SCHEMA_VERSION,
    });
  }
  console.log(`Reset ${users.size} accounts to LKR ${STARTING_CASH.toLocaleString()}.`);
}

main().then(() => process.exit(0), e => (console.error(e), process.exit(1)));
