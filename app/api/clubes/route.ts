import { NextRequest, NextResponse } from 'next/server'
import { getClubesOptimized } from './actions'

// 🚀 OPTIMIZACIÓN FASE 3.2: API route optimizada
export async function GET(request: NextRequest) {
  try {
    const clubes = await getClubesOptimized()
    return NextResponse.json(clubes)
  } catch (error) {
    console.error('Error fetching clubes:', error)
    return NextResponse.json({ error: 'Error fetching clubes' }, { status: 500 })
  }
} 