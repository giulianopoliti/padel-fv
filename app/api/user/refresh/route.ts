import { NextResponse } from 'next/server';
import { getUserDetails } from '@/utils/db/getUserDetails';

export async function GET() {
  try {
    const userDetails = await getUserDetails();
    
    if (!userDetails) {
      return NextResponse.json(
        { error: 'No se encontraron detalles del usuario' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: userDetails });
  } catch (error) {
    console.error('[API] Error refreshing user details:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
} 