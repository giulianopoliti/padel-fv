/**
 * Delete Tournament Bracket API Endpoint
 * DELETE /api/tournaments/[id]/delete-bracket
 * 
 * Completely removes tournament brackets and reverts tournament to zone phase.
 * Cleans up all bracket-related data including seeds, matches, and hierarchy.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params
    
    if (!tournamentId) {
      return NextResponse.json(
        { success: false, error: 'Tournament ID is required' },
        { status: 400 }
      )
    }

    console.log(`[DELETE-BRACKET] 🗑️ Starting bracket deletion for tournament: ${tournamentId}`)

    const supabase = await createClient()

    // 1. Validate tournament exists
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('id, name, status, bracket_generated_at, placeholder_brackets_generated_at')
      .eq('id', tournamentId)
      .single()

    if (tournamentError || !tournament) {
      return NextResponse.json(
        { success: false, error: 'Tournament not found' },
        { status: 404 }
      )
    }

    // 2. Check if bracket exists
    const { data: existingSeeds, error: seedsError } = await supabase
      .from('tournament_couple_seeds')
      .select('id')
      .eq('tournament_id', tournamentId)
      .limit(1)

    if (seedsError) {
      throw new Error(`Error checking existing bracket: ${seedsError.message}`)
    }

    if (!existingSeeds || existingSeeds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No bracket found to delete' },
        { status: 404 }
      )
    }

    // 3. Check if any bracket matches have results
    const { data: finishedMatches, error: finishedError } = await supabase
      .from('matches')
      .select('id')
      .eq('tournament_id', tournamentId)
      .eq('type', 'ELIMINATION')
      .eq('status', 'FINISHED')
      .limit(1)

    if (finishedError) {
      throw new Error(`Error checking finished matches: ${finishedError.message}`)
    }

    if (finishedMatches && finishedMatches.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Cannot delete bracket with finished matches. Bracket has started and has results.' 
        },
        { status: 409 }
      )
    }

    // 4. Get counts before deletion for response
    const { count: seedsCount } = await supabase
      .from('tournament_couple_seeds')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId)

    const { count: matchesCount } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId)
      .eq('type', 'ELIMINATION')

    const { count: hierarchyCount } = await supabase
      .from('match_hierarchy')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId)

    const { count: resolutionsCount } = await supabase
      .from('placeholder_resolutions')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId)

    // 5. Delete all bracket data in transaction
    console.log(`[DELETE-BRACKET] 💾 Deleting bracket data...`)
    console.log(`[DELETE-BRACKET] - Seeds: ${seedsCount || 0}`)
    console.log(`[DELETE-BRACKET] - Matches: ${matchesCount || 0}`)
    console.log(`[DELETE-BRACKET] - Hierarchy: ${hierarchyCount || 0}`)
    console.log(`[DELETE-BRACKET] - Resolutions: ${resolutionsCount || 0}`)

    const { error: transactionError } = await supabase.rpc('begin_transaction')
    if (transactionError) {
      throw new Error(`Transaction start failed: ${transactionError.message}`)
    }

    try {
      // Delete in correct order due to foreign key constraints

      // 1. Delete placeholder resolutions (references seeds)
      if (resolutionsCount && resolutionsCount > 0) {
        const { error: resolutionsDeleteError } = await supabase
          .from('placeholder_resolutions')
          .delete()
          .eq('tournament_id', tournamentId)

        if (resolutionsDeleteError) {
          throw new Error(`Placeholder resolutions delete failed: ${resolutionsDeleteError.message}`)
        }
        console.log(`[DELETE-BRACKET] ✅ Deleted ${resolutionsCount} placeholder resolutions`)
      }

      // 2. Delete match hierarchy (references matches)
      if (hierarchyCount && hierarchyCount > 0) {
        const { error: hierarchyDeleteError } = await supabase
          .from('match_hierarchy')
          .delete()
          .eq('tournament_id', tournamentId)

        if (hierarchyDeleteError) {
          throw new Error(`Match hierarchy delete failed: ${hierarchyDeleteError.message}`)
        }
        console.log(`[DELETE-BRACKET] ✅ Deleted ${hierarchyCount} hierarchy relationships`)
      }

      // 3. Delete bracket matches (elimination type only, keep zone matches)
      if (matchesCount && matchesCount > 0) {
        const { error: matchesDeleteError } = await supabase
          .from('matches')
          .delete()
          .eq('tournament_id', tournamentId)
          .eq('type', 'ELIMINATION')

        if (matchesDeleteError) {
          throw new Error(`Bracket matches delete failed: ${matchesDeleteError.message}`)
        }
        console.log(`[DELETE-BRACKET] ✅ Deleted ${matchesCount} bracket matches`)
      }

      // 4. Delete tournament couple seeds
      if (seedsCount && seedsCount > 0) {
        const { error: seedsDeleteError } = await supabase
          .from('tournament_couple_seeds')
          .delete()
          .eq('tournament_id', tournamentId)

        if (seedsDeleteError) {
          throw new Error(`Tournament seeds delete failed: ${seedsDeleteError.message}`)
        }
        console.log(`[DELETE-BRACKET] ✅ Deleted ${seedsCount} tournament seeds`)
      }

      // 5. Revert tournament status to zone phase
      const { error: tournamentUpdateError } = await supabase
        .from('tournaments')
        .update({
          status: 'ZONE_PHASE',
          bracket_generated_at: null,
          placeholder_brackets_generated_at: null
        })
        .eq('id', tournamentId)

      if (tournamentUpdateError) {
        throw new Error(`Tournament status update failed: ${tournamentUpdateError.message}`)
      }

      // Commit transaction
      const { error: commitError } = await supabase.rpc('commit_transaction')
      if (commitError) {
        throw new Error(`Transaction commit failed: ${commitError.message}`)
      }

      console.log(`[DELETE-BRACKET] ✅ Bracket deletion completed successfully`)

      // 6. Return success response
      return NextResponse.json({
        success: true,
        message: `Bracket deleted successfully. Tournament reverted to zone phase.`,
        data: {
          tournament_id: tournamentId,
          tournament_name: tournament.name,
          deleted_items: {
            seeds: seedsCount || 0,
            matches: matchesCount || 0,
            hierarchy_relationships: hierarchyCount || 0,
            placeholder_resolutions: resolutionsCount || 0
          },
          tournament_status: 'ZONE_PHASE',
          previous_status: tournament.status,
          was_placeholder_bracket: !!tournament.placeholder_brackets_generated_at,
          deletion_timestamp: new Date().toISOString()
        }
      })

    } catch (error: any) {
      // Rollback transaction
      await supabase.rpc('rollback_transaction')
      throw error
    }

  } catch (error: any) {
    console.error('[DELETE-BRACKET] ❌ Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Unknown error deleting bracket' 
      },
      { status: 500 }
    )
  }
}

// GET endpoint for checking what would be deleted
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params
    const supabase = await createClient()

    const { data: tournament } = await supabase
      .from('tournaments')
      .select('id, name, status, bracket_generated_at, placeholder_brackets_generated_at')
      .eq('id', tournamentId)
      .single()

    if (!tournament) {
      return NextResponse.json(
        { success: false, error: 'Tournament not found' },
        { status: 404 }
      )
    }

    // Count items that would be deleted
    const { count: seedsCount } = await supabase
      .from('tournament_couple_seeds')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId)

    const { count: matchesCount } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId)
      .eq('type', 'ELIMINATION')

    const { count: hierarchyCount } = await supabase
      .from('match_hierarchy')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId)

    const { count: resolutionsCount } = await supabase
      .from('placeholder_resolutions')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId)

    const { count: finishedMatchesCount } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId)
      .eq('type', 'ELIMINATION')
      .eq('status', 'FINISHED')

    const hasBracket = (seedsCount || 0) > 0
    const canDelete = hasBracket && (finishedMatchesCount || 0) === 0

    return NextResponse.json({
      tournament: {
        id: tournament.id,
        name: tournament.name,
        status: tournament.status,
        has_placeholder_bracket: !!tournament.placeholder_brackets_generated_at,
        has_regular_bracket: !!tournament.bracket_generated_at
      },
      bracket_exists: hasBracket,
      can_delete: canDelete,
      deletion_blocked_reason: !canDelete && hasBracket ? 'Bracket has finished matches' : null,
      items_to_delete: {
        seeds: seedsCount || 0,
        matches: matchesCount || 0,
        hierarchy_relationships: hierarchyCount || 0,
        placeholder_resolutions: resolutionsCount || 0
      },
      finished_matches_count: finishedMatchesCount || 0
    })

  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}