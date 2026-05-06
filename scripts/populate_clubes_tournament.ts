import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';

// Load .env.local file (Next.js convention)
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

interface TournamentClub {
    tournament_id: string;
    club_id: string;
}

interface PopulationStats {
    total: number;
    successful: number;
    skipped: number;
    errors: number;
    errorDetails: Array<{ tournament_id: string; club_id: string; error: string }>;
}

const main = async () => {
    console.log('🚀 Starting clubes_tournament population script...\n');

    // Validate environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error('❌ Missing SUPABASE env vars: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    }

    // Create Supabase client with service role (bypasses RLS)
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    console.log('✅ Connected to Supabase\n');

    // Step 1: Verify clubes_tournament table exists
    console.log('📋 Step 1: Verifying clubes_tournament table exists...');
    const { error: tableCheckError } = await supabase
        .from('clubes_tournament')
        .select('id')
        .limit(1);

    if (tableCheckError && tableCheckError.code === '42P01') {
        throw new Error('❌ Table clubes_tournament does not exist. Run the migration first.');
    }

    console.log('✅ Table clubes_tournament exists\n');

    // Step 2: Fetch all tournaments with club_id
    console.log('📋 Step 2: Fetching tournaments with club_id...');
    const { data: tournaments, error: tournamentsError } = await supabase
        .from('tournaments')
        .select('id, club_id, name')
        .not('club_id', 'is', null);

    if (tournamentsError) {
        console.error('❌ Error fetching tournaments:', tournamentsError);
        throw tournamentsError;
    }

    console.log(`✅ Found ${tournaments?.length || 0} tournaments with club_id\n`);

    if (!tournaments || tournaments.length === 0) {
        console.log('ℹ️  No tournaments to process. Exiting.');
        return;
    }

    // Step 3: Verify all club_ids exist in clubes table
    console.log('📋 Step 3: Validating club_ids exist in clubes table...');
    const uniqueClubIds = [...new Set(tournaments.map(t => t.club_id))];
    const { data: existingClubs, error: clubsError } = await supabase
        .from('clubes')
        .select('id')
        .in('id', uniqueClubIds);

    if (clubsError) {
        console.error('❌ Error validating clubs:', clubsError);
        throw clubsError;
    }

    const existingClubIds = new Set(existingClubs?.map(c => c.id) || []);
    const invalidTournaments = tournaments.filter(t => !existingClubIds.has(t.club_id));

    if (invalidTournaments.length > 0) {
        console.warn(`⚠️  Warning: ${invalidTournaments.length} tournaments have invalid club_ids:`);
        invalidTournaments.forEach(t => {
            console.warn(`   - Tournament: ${t.name} (${t.id}) → Invalid club_id: ${t.club_id}`);
        });
        console.log('');
    }

    const validTournaments = tournaments.filter(t => existingClubIds.has(t.club_id));
    console.log(`✅ ${validTournaments.length} tournaments have valid club_ids\n`);

    // Step 4: Check existing records in clubes_tournament
    console.log('📋 Step 4: Checking existing records in clubes_tournament...');
    const { data: existingRecords, error: existingError } = await supabase
        .from('clubes_tournament')
        .select('tournament_id, club_id');

    if (existingError) {
        console.error('❌ Error fetching existing records:', existingError);
        throw existingError;
    }

    const existingPairs = new Set(
        existingRecords?.map(r => `${r.tournament_id}:${r.club_id}`) || []
    );

    console.log(`✅ Found ${existingPairs.size} existing records\n`);

    // Step 5: Populate clubes_tournament
    console.log('📋 Step 5: Populating clubes_tournament table...\n');

    const stats: PopulationStats = {
        total: validTournaments.length,
        successful: 0,
        skipped: 0,
        errors: 0,
        errorDetails: []
    };

    for (const tournament of validTournaments) {
        const pairKey = `${tournament.id}:${tournament.club_id}`;

        // Skip if already exists
        if (existingPairs.has(pairKey)) {
            console.log(`⏭️  Skipped: ${tournament.name} → club already associated`);
            stats.skipped++;
            continue;
        }

        // Insert new record
        const { error: insertError } = await supabase
            .from('clubes_tournament')
            .insert({
                tournament_id: tournament.id,
                club_id: tournament.club_id
            });

        if (insertError) {
            console.error(`❌ Error: ${tournament.name} (${tournament.id})`);
            console.error(`   ${insertError.message}`);
            stats.errors++;
            stats.errorDetails.push({
                tournament_id: tournament.id,
                club_id: tournament.club_id,
                error: insertError.message
            });
        } else {
            console.log(`✅ Success: ${tournament.name} → club_id: ${tournament.club_id}`);
            stats.successful++;
        }
    }

    // Step 6: Final report
    console.log('\n' + '='.repeat(60));
    console.log('📊 POPULATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total tournaments processed:  ${stats.total}`);
    console.log(`✅ Successfully inserted:     ${stats.successful}`);
    console.log(`⏭️  Skipped (already exists): ${stats.skipped}`);
    console.log(`❌ Errors:                    ${stats.errors}`);
    console.log('='.repeat(60));

    if (stats.errorDetails.length > 0) {
        console.log('\n❌ Error Details:');
        stats.errorDetails.forEach(detail => {
            console.log(`   Tournament: ${detail.tournament_id}`);
            console.log(`   Club: ${detail.club_id}`);
            console.log(`   Error: ${detail.error}\n`);
        });
    }

    // Step 7: Verification query
    console.log('\n📋 Step 7: Verification - Querying final state...');
    const { data: finalCount, error: countError } = await supabase
        .from('clubes_tournament')
        .select('id', { count: 'exact', head: true });

    if (!countError) {
        console.log(`✅ Total records in clubes_tournament: ${finalCount}`);
    }

    // Sample query to show some results
    const { data: sampleRecords, error: sampleError } = await supabase
        .from('clubes_tournament')
        .select(`
            id,
            tournament_id,
            club_id,
            tournaments:tournament_id (name),
            clubes:club_id (name)
        `)
        .limit(5);

    if (!sampleError && sampleRecords && sampleRecords.length > 0) {
        console.log('\n📋 Sample records:');
        sampleRecords.forEach((record: any) => {
            console.log(`   - Tournament: "${record.tournaments?.name}" → Club: "${record.clubes?.name}"`);
        });
    }

    console.log('\n✅ Population script completed successfully!');
};

main().catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
});
