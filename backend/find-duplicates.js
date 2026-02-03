const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findDuplicates() {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, created_at, land_area_sqm, polyhouse_count')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('All projects:');
  console.table(data);

  const duplicates = [];
  const names = new Map();

  data?.forEach(project => {
    const key = project.name;
    if (!names.has(key)) {
      names.set(key, []);
    }
    names.get(key).push(project);
  });

  console.log('\n=== Duplicates ===');
  names.forEach((projects, name) => {
    if (projects.length > 1) {
      console.log(`\n"${name}" has ${projects.length} copies:`);
      projects.forEach((p, idx) => {
        console.log(`  ${idx + 1}. ID: ${p.id}, Created: ${p.created_at}`);
        if (idx > 0) {
          duplicates.push(p.id);
        }
      });
    }
  });

  if (duplicates.length > 0) {
    console.log('\n=== IDs to delete (keeping oldest) ===');
    console.log(duplicates.join('\n'));
  } else {
    console.log('\nNo duplicates found');
  }
}

findDuplicates();
