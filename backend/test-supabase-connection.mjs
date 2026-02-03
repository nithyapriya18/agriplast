#!/usr/bin/env node
/**
 * Test script to verify Supabase connection and user_settings access
 * Run with: node test-supabase-connection.mjs
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

console.log('🔍 Testing Supabase Connection...\n');
console.log('Configuration:');
console.log('  SUPABASE_URL:', supabaseUrl ? '✅ SET' : '❌ MISSING');
console.log('  SUPABASE_SERVICE_KEY:', supabaseServiceKey ? '✅ SET (length: ' + supabaseServiceKey.length + ')' : '❌ MISSING');
console.log('');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testConnection() {
  try {
    // Test 1: Check if table exists
    console.log('Test 1: Checking if user_settings table exists...');
    const { data: tables, error: tableError } = await supabase
      .from('user_settings')
      .select('*')
      .limit(1);

    if (tableError) {
      if (tableError.code === '42P01') {
        console.error('❌ Table user_settings does not exist!');
        console.log('\n📋 Action required:');
        console.log('   Run the SQL migration in Supabase dashboard:');
        console.log('   supabase/migrations/FIX_406_COMPLETE.sql\n');
        return false;
      } else if (tableError.code === 'PGRST116') {
        console.log('✅ Table exists (no rows yet)');
      } else {
        console.error('❌ Error accessing user_settings:');
        console.error('   Message:', tableError.message);
        console.error('   Code:', tableError.code);
        console.error('   Details:', tableError.details);
        console.error('   Hint:', tableError.hint);
        console.log('\n📋 Action required:');
        console.log('   Run the SQL migration in Supabase dashboard:');
        console.log('   supabase/migrations/FIX_406_COMPLETE.sql\n');
        return false;
      }
    } else {
      console.log('✅ Table exists and is accessible');
      console.log('   Current rows:', tables ? tables.length : 0);
      if (tables && tables.length > 0) {
        console.log('   Sample columns:', Object.keys(tables[0]).join(', '));
      }
    }

    // Test 2: Try to insert a test record (will rollback if FK fails)
    console.log('\nTest 2: Testing write permissions...');
    const testUserId = '00000000-0000-0000-0000-000000000001';
    const { error: insertError } = await supabase
      .from('user_settings')
      .upsert({
        user_id: testUserId,
        max_side_length: 120.0,
        polyhouse_gap: 2.0,
      }, { onConflict: 'user_id' });

    if (insertError) {
      if (insertError.code === '23503') {
        console.log('✅ Write permissions working (FK constraint expected - test user doesn\'t exist)');
      } else if (insertError.code === '42501') {
        console.error('❌ Permission denied! Service role cannot write to table.');
        console.log('\n📋 Action required:');
        console.log('   Run this SQL in Supabase dashboard:');
        console.log('   GRANT ALL ON public.user_settings TO service_role;\n');
        return false;
      } else {
        console.error('❌ Write permission error:', insertError.message);
        console.error('   Code:', insertError.code);
        return false;
      }
    } else {
      console.log('✅ Write permissions working');
      // Clean up test record
      await supabase.from('user_settings').delete().eq('user_id', testUserId);
    }

    console.log('\n✅ All tests passed! Supabase connection is working correctly.');
    return true;

  } catch (error) {
    console.error('\n❌ Unexpected error:', error.message);
    console.error(error);
    return false;
  }
}

testConnection().then(success => {
  if (success) {
    console.log('\n🎉 Backend should be able to access user_settings successfully!');
    console.log('   Polyhouses should now render without 406 errors.');
    process.exit(0);
  } else {
    console.log('\n⚠️  Please fix the issues above and run this test again.');
    process.exit(1);
  }
});
