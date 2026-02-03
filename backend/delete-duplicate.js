import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function deleteDuplicate() {
  const duplicateId = '3b839dbc-ab1f-496b-bd67-ce6290deb04a';

  console.log(`Deleting duplicate project with ID: ${duplicateId}`);

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', duplicateId);

  if (error) {
    console.error('Error deleting duplicate:', error);
  } else {
    console.log('✓ Successfully deleted duplicate project');
  }
}

deleteDuplicate();
