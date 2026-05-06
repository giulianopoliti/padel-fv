import { NextRequest, NextResponse } from 'next/server'
import { getUserRoleOptimized } from '@/app/api/clubes/actions'

// 🚀 OPTIMIZACIÓN FASE 3.2: API route optimizada para user role
export async function GET(request: NextRequest) {
  try {
    const role = await getUserRoleOptimized()
    return NextResponse.json({ role })
  } catch (error) {
    console.log('User not authenticated')
    return NextResponse.json({ role: null }, { status: 401 })
  }
} 