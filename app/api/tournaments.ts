import { createClient } from "@/utils/supabase/server";
import { Category, Tournament } from "@/types";
import { getTenantOrganization } from "@/lib/services/tenant-organization.service";

/**
 * Calculate total participants for a set of inscriptions.
 * - Individual inscription (couple_id === null) counts as 1 participant
 * - Couple inscription (couple_id !== null) counts as 2 participants
 */
function calculateParticipants(inscriptions: { couple_id: string | null }[]): number {
  let individual = 0;
  let couples = 0;

  for (const ins of inscriptions) {
    if (ins.couple_id) {
      couples += 1;
    } else {
      individual += 1;
    }
  }

  return individual + couples * 2;
}

export async function getTournaments() {
    try {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from("tournaments")
            .select(`
                *,
                club:clubes (
                    id,
                    name,
                    address,
                    cover_image_url
                )
            `)
            .order("start_date", { ascending: false });

        if (error) {
            console.error("Error fetching tournaments:", error);
            return [];
        }

        // Get current participants count for each tournament
        const tournamentsWithParticipants = [];
        if (data && data.length > 0) {
            for (const rawTournament of data) {
                const { data: inscriptions, error: inscriptionsError } = await supabase
                    .from("inscriptions")
                    .select("couple_id")
                    .eq("tournament_id", rawTournament.id);

                if (inscriptionsError) {
                    console.error(`Error fetching inscriptions for tournament ${rawTournament.id}:`, inscriptionsError);
                }

                const currentParticipants = inscriptions ? calculateParticipants(inscriptions as { couple_id: string | null }[]) : 0;

                // Create a plain object with properly serialized data
                const tournament = {
                    id: rawTournament.id,
                    name: rawTournament.name,
                    club: rawTournament.club ? {
                        id: rawTournament.club.id,
                        name: rawTournament.club.name,
                        image: rawTournament.club.cover_image_url
                    } : null,
                    createdAt: rawTournament.created_at || null,
                    startDate: rawTournament.start_date || null,
                    endDate: rawTournament.end_date || null,
                    category: rawTournament.category_name || null,
                    gender: rawTournament.gender || "MALE",
                    status: rawTournament.status || "NOT_STARTED",
                    type: rawTournament.type || "AMERICAN",
                    pre_tournament_image_url: rawTournament.pre_tournament_image_url || null,
                    price: rawTournament.price || null,
                    description: rawTournament.description || null,
                    maxParticipants: rawTournament.max_participants || null,
                    currentParticipants: currentParticipants,
                    address: rawTournament.club?.address || null,
                    // Convert time to string on client side instead of server side
                    time: null,
                    prize: (rawTournament.description && 
                           (rawTournament.description.includes('premio') || rawTournament.description.includes('$'))) 
                        ? rawTournament.description 
                        : null
                };

                tournamentsWithParticipants.push(tournament);
            }
        }

        return tournamentsWithParticipants;
    } catch (error) {
        console.error("Error in getTournaments:", error);
        return [];
    }
}

export async function getCategories() {
    try {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from("categories")
            .select("*")
            .order("name")
    
        if (error) {
            console.error("Error fetching categories:", error)
            return []
        }

        // Ensure we return plain objects
        return (data || []).map((category: any) => ({
            name: category.name,
            lower_range: category.lower_range,
            upper_range: category.upper_range
        })) as Category[]
    } catch (error) {
        console.error("Error in getCategories:", error);
        return [];
    }
}

export async function getWeeklyWinners() {
    try {
        const supabase = await createClient();
        // Calculate date 7 days ago
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        
        // Get tournaments finished in the last 7 days with winner information
        const { data: tournaments, error } = await supabase
            .from('tournaments')
            .select('id, name, winner_image_url, end_date, winner_id')
            .in('status', ['FINISHED', 'FINISHED_POINTS_CALCULATED'])
            .not('winner_id', 'is', null)
            .not('winner_image_url', 'is', null)
            .gte('end_date', weekAgo.toISOString())
            .order('end_date', { ascending: false })
            .limit(6);

        if (error || !tournaments) {
            console.error('Error fetching weekly winners:', error);
            return [];
        }

        // 🚀 OPTIMIZACIÓN FASE 2: Paralelizar queries de detalles de ganadores
        const winnerPromises = tournaments.map(async (tournament) => {
            const { data: couple, error: coupleError } = await supabase
                .from('couples')
                .select(`
                    id,
                    player1:players!couples_player1_id_fkey(first_name, last_name),
                    player2:players!couples_player2_id_fkey(first_name, last_name)
                `)
                .eq('id', tournament.winner_id)
                .single();

            if (!coupleError && couple) {
                const player1 = Array.isArray(couple.player1) ? couple.player1[0] : couple.player1;
                const player2 = Array.isArray(couple.player2) ? couple.player2[0] : couple.player2;

                // Create plain object for serialization
                return {
                    id: tournament.id,
                    tournamentName: tournament.name,
                    winnerImageUrl: tournament.winner_image_url,
                    endDate: tournament.end_date,
                    winner: {
                        id: couple.id,
                        player1Name: `${player1?.first_name || ''} ${player1?.last_name || ''}`.trim(),
                        player2Name: `${player2?.first_name || ''} ${player2?.last_name || ''}`.trim(),
                    }
                };
            }
            return null;
        });

        const winnersWithDetails = (await Promise.all(winnerPromises)).filter(Boolean);

        return winnersWithDetails;
    } catch (error) {
        console.error('Unexpected error fetching weekly winners:', error);
        return [];
    }
}

export async function getTournamentById(id: string) {
    try {
        const supabase = await createClient();
        const { data: tournamentData, error: tournamentError } = await supabase
        .from('tournaments')
        .select(`
        *,
        club:clubes (
        id,
        name,
        address
      )
    `)
        .eq('id', id)
        .single()
    
        if (tournamentError || !tournamentData) {
            console.error("Error fetching tournament:", tournamentError);
            return null;
        }

        // Create plain object for serialization
        const tournament: Tournament = {
            id: tournamentData.id,
            name: tournamentData.name,
            club: tournamentData.club,
            createdAt: tournamentData.created_at,
            startDate: tournamentData.start_date,
            endDate: tournamentData.end_date,
            category: tournamentData.category,
            gender: tournamentData.gender || "MALE",
            status: tournamentData.status || "NOT_STARTED",
            type: tournamentData.type || "AMERICAN"
        };

        return tournament;
    } catch (error) {
        console.error("Error in getTournamentById:", error);
        return null;
    }
}

/**
 * OPTIMIZED: Get upcoming tournaments for home page - only fetches the next 3 tournaments
 * This reduces DB queries from ~20+ to just 4 queries total
 */
export async function getUpcomingTournamentsForHome(limit: number = 3) {
    try {
        const supabase = await createClient();
        const tenantOrganization = await getTenantOrganization();

        // Single query to get upcoming tournaments with club info, filtered and limited
        let query = supabase
            .from("tournaments")
            .select(`
                id,
                name,
                created_at,
                start_date,
                end_date,
                category_name,
                gender,
                status,
                type,
                pre_tournament_image_url,
                price,
                award,
                enable_public_inscriptions,
                description,
                max_participants,
                club:clubes (
                    id,
                    name,
                    address,
                    cover_image_url
                )
            `)
            .eq("status", "NOT_STARTED")
            .order("start_date", { ascending: true })
            .limit(limit);

        if (tenantOrganization) {
            query = query.eq("organization_id", tenantOrganization.id);
        }

        const { data: tournaments, error } = await query;

        if (error) {
            console.error("Error fetching upcoming tournaments for home:", error);
            return [];
        }

        if (!tournaments || tournaments.length === 0) {
            return [];
        }

        // Get inscriptions count for all tournaments in one query
        const tournamentIds = tournaments.map((t: any) => t.id);
        const { data: allInscriptions, error: inscriptionsError } = await supabase
            .from("inscriptions")
            .select("tournament_id, couple_id")
            .in("tournament_id", tournamentIds);

        if (inscriptionsError) {
            console.error("Error fetching inscriptions for home tournaments:", inscriptionsError);
        }

        // Build final tournament objects with participants count
        const tournamentsWithParticipants = tournaments.map((rawTournament: any) => {
            const inscriptions = allInscriptions?.filter((i: any) => i.tournament_id === rawTournament.id) || [];
            const currentParticipants = calculateParticipants(inscriptions as { couple_id: string | null }[]);

            return {
                id: rawTournament.id,
                name: rawTournament.name,
                club: rawTournament.club ? {
                    id: rawTournament.club.id,
                    name: rawTournament.club.name,
                    image: rawTournament.club.cover_image_url
                } : null,
                createdAt: rawTournament.created_at || null,
                startDate: rawTournament.start_date || null,
                endDate: rawTournament.end_date || null,
                category: rawTournament.category_name || null,
                gender: rawTournament.gender || "MALE",
                status: rawTournament.status || "NOT_STARTED",
                type: rawTournament.type || "AMERICAN",
                pre_tournament_image_url: rawTournament.pre_tournament_image_url || null,
                price: rawTournament.price || null,
                award: rawTournament.award || null,
                enablePublicInscriptions: Boolean(rawTournament.enable_public_inscriptions),
                description: rawTournament.description || null,
                maxParticipants: rawTournament.max_participants || null,
                currentParticipants: currentParticipants,
                address: rawTournament.club?.address || null,
                time: null,
                prize: (rawTournament.description &&
                       (rawTournament.description.includes('premio') || rawTournament.description.includes('$')))
                    ? rawTournament.description
                    : null
            };
        });

        return tournamentsWithParticipants;
    } catch (error) {
        console.error("Error in getUpcomingTournamentsForHome:", error);
        return [];
    }
}

/**
 * OPTIMIZED: Get tournaments with filters, pagination, and single query
 * Reduces N+1 queries to a single query with JOINs
 */
export async function getTournamentsOptimized({
    status,
    page = 1,
    limit = 12,
    filters = {}
}: {
    status: 'upcoming' | 'in-progress' | 'past',
    page?: number,
    limit?: number,
    filters?: {
        categoryName?: string,
        organizationId?: string,
        clubId?: string,
        type?: "LONG" | "AMERICAN",
        dateFrom?: string,
        dateTo?: string,
        search?: string
    }
}) {
    try {
        const supabase = await createClient();
        const tenantOrganization = await getTenantOrganization();

        // Map status to database status values
        const statusMap = {
            'upcoming': ['NOT_STARTED'],
            'in-progress': ['IN_PROGRESS', 'ZONE_PHASE', 'BRACKET_PHASE'],
            'past': ['FINISHED', 'FINISHED_POINTS_PENDING', 'FINISHED_POINTS_CALCULATED']
        };

        const dbStatuses = statusMap[status];
        const offset = (page - 1) * limit;

        // Build base query
        let query = supabase
            .from("tournaments")
            .select(`
                id,
                name,
                created_at,
                start_date,
                end_date,
                category_name,
                gender,
                status,
                type,
                pre_tournament_image_url,
                price,
                award,
                enable_public_inscriptions,
                description,
                max_participants,
                organization_id,
                club:clubes (
                    id,
                    name,
                    address,
                    cover_image_url
                ),
                organization:organizaciones (
                    id,
                    name
                )
            `, { count: 'exact' })
            .in("status", dbStatuses)
            .neq("is_draft", true);

        if (tenantOrganization) {
            query = query.eq("organization_id", tenantOrganization.id);
        }

        // Apply filters
        if (filters.categoryName) {
            query = query.eq("category_name", filters.categoryName);
        }

        if (filters.organizationId) {
            query = query.eq("organization_id", filters.organizationId);
        }

        if (filters.clubId) {
            query = query.eq("club_id", filters.clubId);
        }

        if (filters.type) {
            query = query.eq("type", filters.type);
        }

        if (filters.dateFrom) {
            query = query.gte("start_date", filters.dateFrom);
        }

        if (filters.dateTo) {
            query = query.lte("start_date", filters.dateTo);
        }

        // Apply search filter (case-insensitive)
        if (filters.search) {
            query = query.or(`name.ilike.%${filters.search}%`);
        }

        // Order and paginate
        const orderDirection = status === 'past' ? { ascending: false } : { ascending: true };
        query = query
            .order("start_date", orderDirection)
            .range(offset, offset + limit - 1);

        const { data: tournaments, error, count } = await query;

        if (error) {
            console.error("Error fetching tournaments optimized:", error);
            return { tournaments: [], totalCount: 0, totalPages: 0 };
        }

        if (!tournaments || tournaments.length === 0) {
            return { tournaments: [], totalCount: count || 0, totalPages: 0 };
        }

        // Get inscriptions count for all tournaments in one query
        const tournamentIds = tournaments.map((t: any) => t.id);
        const { data: allInscriptions, error: inscriptionsError } = await supabase
            .from("inscriptions")
            .select("tournament_id, couple_id")
            .in("tournament_id", tournamentIds);

        if (inscriptionsError) {
            console.error("Error fetching inscriptions:", inscriptionsError);
        }

        // Build final tournament objects with participants count
        const tournamentsWithParticipants = tournaments.map((rawTournament: any) => {
            const inscriptions = allInscriptions?.filter((i: any) => i.tournament_id === rawTournament.id) || [];
            const currentParticipants = calculateParticipants(inscriptions as { couple_id: string | null }[]);

            return {
                id: rawTournament.id,
                name: rawTournament.name,
                club: rawTournament.club ? {
                    id: rawTournament.club.id,
                    name: rawTournament.club.name,
                    image: rawTournament.club.cover_image_url
                } : null,
                organization: rawTournament.organization ? {
                    id: rawTournament.organization.id,
                    name: rawTournament.organization.name
                } : null,
                createdAt: rawTournament.created_at || null,
                startDate: rawTournament.start_date || null,
                endDate: rawTournament.end_date || null,
                category: rawTournament.category_name || null,
                gender: rawTournament.gender || "MALE",
                status: rawTournament.status || "NOT_STARTED",
                type: rawTournament.type || "AMERICAN",
                pre_tournament_image_url: rawTournament.pre_tournament_image_url || null,
                price: rawTournament.price || null,
                award: rawTournament.award || null,
                enablePublicInscriptions: Boolean(rawTournament.enable_public_inscriptions),
                description: rawTournament.description || null,
                maxParticipants: rawTournament.max_participants || null,
                currentParticipants: currentParticipants,
                address: rawTournament.club?.address || null,
                time: null,
                prize: (rawTournament.description &&
                       (rawTournament.description.includes('premio') || rawTournament.description.includes('$')))
                    ? rawTournament.description
                    : null
            };
        });

        const totalPages = Math.ceil((count || 0) / limit);

        return {
            tournaments: tournamentsWithParticipants,
            totalCount: count || 0,
            totalPages
        };
    } catch (error) {
        console.error("Error in getTournamentsOptimized:", error);
        return { tournaments: [], totalCount: 0, totalPages: 0 };
    }
}

/**
 * Get all organizations for filter dropdown
 */
export async function getOrganizationsForFilter() {
    try {
        const tenantOrganization = await getTenantOrganization();

        if (!tenantOrganization) {
            return [];
        }

        return [{ id: tenantOrganization.id, name: tenantOrganization.name }];
    } catch (error) {
        console.error("Error in getOrganizationsForFilter:", error);
        return [];
    }
}

/**
 * Get all clubs for filter dropdown
 */
export async function getClubsForFilter() {
    try {
        const supabase = await createClient();
        const tenantOrganization = await getTenantOrganization();

        if (!tenantOrganization) {
            return [];
        }

        const { data, error } = await supabase
            .from("organization_clubs")
            .select("clubes(id, name)")
            .eq("organizacion_id", tenantOrganization.id);

        if (error) {
            console.error("Error fetching clubs:", error);
            return [];
        }

        return (data || [])
            .map((item: any) => item.clubes)
            .filter(Boolean)
            .sort((clubA: { name: string }, clubB: { name: string }) => clubA.name.localeCompare(clubB.name));
    } catch (error) {
        console.error("Error in getClubsForFilter:", error);
        return [];
    }
}

