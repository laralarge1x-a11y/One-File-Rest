import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function migrate(): Promise<void> {
  const schemaPath = path.join(__dirname, 'schema.sql');

  try {
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    console.log('Running database migrations...');
    await pool.query(schema);
    console.log('✓ Database schema migrated successfully');

    process.exit(0);
  } catch (err) {
    console.error('✗ Migration failed:', err);
    process.exit(1);
  }
}

migrate();
