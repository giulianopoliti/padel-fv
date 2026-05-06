import { createClient } from "./supabase/server";


export async function getZonePositions(tournamentId: string) {
    const supabase = await createClient();
    const zonesCount = await supabase.from('zones').select('id').eq('tournament_id', tournamentId);
}