/**
 * Script temporal para probar la recalculación de posiciones de zona
 */

console.log('🔧 Testing zone positions update...')

async function testZoneUpdate() {
  try {
    const tournamentId = 'cc94fef0-48f0-4987-9613-99c960ece12c'
    const zoneId = '408258cc-93e8-4dda-8b4c-79fce8164af1' // Zona C
    
    console.log(`📊 Testing updateZonePositions for tournament ${tournamentId}, zone ${zoneId}`)
    
    // Importar la función desde actions
    const { updateZonePositionsAction } = await import('./app/api/tournaments/[id]/actions.ts')
    
    console.log('🚀 Calling updateZonePositionsAction...')
    const result = await updateZonePositionsAction(tournamentId, zoneId)
    
    console.log('📈 Result:', result)
    
    if (result.success) {
      console.log('✅ Zone positions updated successfully!')
      console.log(`📊 Positions updated: ${result.positionsUpdated}`)
    } else {
      console.log('❌ Update failed:', result.message)
    }
    
  } catch (error) {
    console.error('💥 Error testing zone update:', error)
    console.error('Stack:', error.stack)
  }
}

testZoneUpdate().then(() => {
  console.log('🏁 Test completed')
  process.exit(0)
}).catch(error => {
  console.error('💥 Test failed:', error)
  process.exit(1)
})