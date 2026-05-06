import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';

// Load .env.local file (Next.js convention)
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

interface TournamentClub {
    idTournament: string;
    idClub: string;
}

const main = async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error('Missing SUPABASE env vars: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    console.log('🔍 Fetching tournaments and clubs...\n');

    const { data: tournaments, error: tournamentsError } = await supabase
        .from('tournaments')
        .select('id, club_id');

    if (tournamentsError) {
        console.error('❌ Error fetching tournaments:', tournamentsError);
        throw tournamentsError;
    }

    const clubes_tournaments: TournamentClub[] = [];
    for (const tournament of tournaments || []) {
        clubes_tournaments.push({
            idTournament: tournament.id,
            idClub: tournament.club_id
        });
    }

    console.log('📊 Tournament-Club relationships:\n');
    for (const tournament_club of clubes_tournaments) {
        console.log(`  Tournament: ${tournament_club.idTournament} → Club: ${tournament_club.idClub}`);
    }

    console.log(`\n✅ Total found: ${clubes_tournaments.length} tournaments`);
    console.log('\n📋 Full array:');
    console.log(JSON.stringify(clubes_tournaments, null, 2));
};

main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});