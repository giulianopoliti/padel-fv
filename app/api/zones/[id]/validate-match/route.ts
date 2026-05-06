import { NextRequest, NextResponse } from 'next/server';
import { MatchValidationService } from '@/lib/services/match-validation.service';
import { createClient } from '@/utils/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const zoneId = params.id;
    const body = await request.json();
    const { couple1Id, couple2Id } = body;

    if (!couple1Id || !couple2Id) {
      return NextResponse.json(
        { error: 'couple1Id and couple2Id are required' },
        { status: 400 }
      );
    }

    // Validate user authentication
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      );
    }

    // Perform validation
    const validation = await MatchValidationService.validateMatchCreation(
      zoneId,
      couple1Id,
      couple2Id
    );

    return NextResponse.json({
      isValid: validation.isValid,
      errors: validation.errors,
      warnings: validation.warnings || []
    });

  } catch (error) {
    console.error('Error validating match:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}