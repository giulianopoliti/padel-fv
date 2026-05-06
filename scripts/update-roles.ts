import { createClient } from '@/lib/supabase/server';

/**
 * This script updates old role names to new role names in the users table
 * JUGADOR -> PLAYER
 * ENTRENADOR -> COACH
 * 
 * Run this script once with:
 * npx ts-node scripts/update-roles.ts
 */
async function updateRoles() {
  console.log('Starting role update...');
  
  const supabase = await createClient();
  
  // Update JUGADOR to PLAYER
  const { data: updatedPlayers, error: playerError } = await supabase
    .from('users')
    .update({ role: 'PLAYER' })
    .eq('role', 'PLAYER')
    .select();
    
  if (playerError) {
    console.error('Error updating player roles:', playerError);
  } else {
    console.log(`Updated ${updatedPlayers?.length || 0} player roles`);
  }
  
  // Update ENTRENADOR to COACH
  const { data: updatedCoaches, error: coachError } = await supabase
    .from('users')
    .update({ role: 'COACH' })
    .eq('role', 'COACH')
    .select();
    
  if (coachError) {
    console.error('Error updating coach roles:', coachError);
  } else {
    console.log(`Updated ${updatedCoaches?.length || 0} coach roles`);
  }
  
  console.log('Role update complete!');
}

// Only run this if executed directly
if (require.main === module) {
  updateRoles()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Error:', error);
      process.exit(1);
    });
} 