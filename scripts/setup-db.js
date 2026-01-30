import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load .env file
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env file');
  process.exit(1);
}

console.log('Connecting to:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log('Running database setup...\n');

  // Check if wards table exists
  const { data: wards, error: selectError } = await supabase
    .from('wards')
    .select('id')
    .limit(1);

  if (selectError) {
    console.error('Error accessing wards table:', selectError.message);
    console.log('\nThe wards table may not exist. Please run the schema.sql in Supabase SQL Editor:');
    console.log('1. Go to https://supabase.com/dashboard/project/paeuwrptxluoerneviee/sql');
    console.log('2. Copy the contents of supabase/schema.sql');
    console.log('3. Paste and click "Run"');
    return;
  }

  console.log('Wards table exists. Checking data...');

  // Get existing wards
  const { data: existingWards, error: listError } = await supabase
    .from('wards')
    .select('*')
    .order('floor')
    .order('name');

  if (listError) {
    console.error('Error listing wards:', listError.message);
    return;
  }

  if (!existingWards || existingWards.length === 0) {
    console.log('No wards found. Inserting default wards...');
    const { error: insertError } = await supabase
      .from('wards')
      .insert([
        { name: 'North Wing', floor: 1, capacity: 25, description: 'Rehabilitation unit' },
        { name: 'East Wing', floor: 1, capacity: 30, description: 'Long-term care unit' },
        { name: 'West Wing', floor: 2, capacity: 20, description: 'Hospice care unit' },
        { name: 'Memory Care', floor: 2, capacity: 15, description: 'Memory care unit' },
      ]);

    if (insertError) {
      console.error('Error inserting wards:', insertError.message);
    } else {
      console.log('Default wards inserted successfully!');
    }

    // Re-fetch wards
    const { data: newWards } = await supabase
      .from('wards')
      .select('*')
      .order('floor')
      .order('name');

    console.log('\nCurrent wards in database:');
    console.table(newWards);
  } else {
    console.log(`Found ${existingWards.length} existing wards:`);
    console.table(existingWards);
  }
}

runMigration().catch(console.error);
