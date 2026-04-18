/**
 * Migration manuelle : corrige les contraintes FK qui bloquent la suppression d'un user.
 * 
 * À exécuter UNE SEULE FOIS sur une base existante :
 *   npx tsx src/db/migrate-fk.ts
 * 
 * Sur une base neuve (db:push depuis zéro), ce script n'est pas nécessaire
 * car le schéma corrigé sera appliqué directement.
 */

import postgres from 'postgres';
import 'dotenv/config';

const sql = postgres(process.env.DATABASE_URL!);

async function run() {
  console.log('🔧 Correction des contraintes FK...\n');

  const fixes: { table: string; oldConstraint: string; column: string; ref: string; action: string }[] = [
    // invitations.invited_by
    {
      table: 'invitations',
      oldConstraint: 'invitations_invited_by_users_id_fk',
      column: 'invited_by',
      ref: 'users(id)',
      action: 'SET NULL',
    },
    // invitations.invited_user_id
    {
      table: 'invitations',
      oldConstraint: 'invitations_invited_user_id_users_id_fk',
      column: 'invited_user_id',
      ref: 'users(id)',
      action: 'SET NULL',
    },
    // channels.created_by
    {
      table: 'channels',
      oldConstraint: 'channels_created_by_users_id_fk',
      column: 'created_by',
      ref: 'users(id)',
      action: 'SET NULL',
    },
    // messages.author_id
    {
      table: 'messages',
      oldConstraint: 'messages_author_id_users_id_fk',
      column: 'author_id',
      ref: 'users(id)',
      action: 'SET NULL',
    },
    // reservations.requested_by
    {
      table: 'reservations',
      oldConstraint: 'reservations_requested_by_users_id_fk',
      column: 'requested_by',
      ref: 'users(id)',
      action: 'SET NULL',
    },
    // reservations.reviewed_by
    {
      table: 'reservations',
      oldConstraint: 'reservations_reviewed_by_users_id_fk',
      column: 'reviewed_by',
      ref: 'users(id)',
      action: 'SET NULL',
    },
  ];

  for (const fix of fixes) {
    try {
      // Supprimer l'ancienne contrainte
      await sql.unsafe(`
        ALTER TABLE ${fix.table}
        DROP CONSTRAINT IF EXISTS "${fix.oldConstraint}"
      `);

      // Recréer avec ON DELETE SET NULL
      const newName = `${fix.table}_${fix.column}_fk`;
      await sql.unsafe(`
        ALTER TABLE ${fix.table}
        ADD CONSTRAINT "${newName}"
        FOREIGN KEY (${fix.column})
        REFERENCES ${fix.ref}
        ON DELETE ${fix.action}
      `);

      console.log(`  ✅ ${fix.table}.${fix.column} → ON DELETE ${fix.action}`);
    } catch (err: any) {
      console.error(`  ❌ ${fix.table}.${fix.column} : ${err.message}`);
    }
  }

  // Aussi s'assurer que invited_by et created_by acceptent NULL
  try {
    await sql`ALTER TABLE invitations ALTER COLUMN invited_by DROP NOT NULL`;
    console.log('  ✅ invitations.invited_by → nullable');
  } catch (_) {}

  try {
    await sql`ALTER TABLE channels ALTER COLUMN created_by DROP NOT NULL`;
    console.log('  ✅ channels.created_by → nullable');
  } catch (_) {}

  try {
    await sql`ALTER TABLE messages ALTER COLUMN author_id DROP NOT NULL`;
    console.log('  ✅ messages.author_id → nullable');
  } catch (_) {}

  try {
    await sql`ALTER TABLE reservations ALTER COLUMN requested_by DROP NOT NULL`;
    console.log('  ✅ reservations.requested_by → nullable');
  } catch (_) {}

  console.log('\n✨ Migration terminée.');
  await sql.end();
}

run().catch(e => { console.error(e); process.exit(1); });
