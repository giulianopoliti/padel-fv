// Test script to manually trigger zone position calculation for Zone A
const { ZonePositionService } = require('./lib/services/zone-position/zone-position.service.ts')

async function testZoneACalculation() {
  try {
    const zonePositionService = new ZonePositionService()
    const tournamentId = 'cc94fef0-48f0-4987-9613-99c960ece12c'
    const zoneId = 'b132f203-50c5-4f8a-8326-ffc2bdaa496c' // Zone A
    
    console.log('Testing Zone A position calculation...')
    console.log('Tournament ID:', tournamentId)
    console.log('Zone ID (Zone A):', zoneId)
    
    // Test calculateZonePositions method first
    console.log('\n1. Testing calculateZonePositions...')
    const result = await zonePositionService.calculateZonePositions(zoneId)
    console.log('Calculation result:', JSON.stringify(result, null, 2))
    
    // Test updating database
    console.log('\n2. Testing updateZonePositionsInDatabase...')
    const updateResult = await zonePositionService.updateZonePositionsInDatabase(tournamentId, zoneId)
    console.log('Update result:', JSON.stringify(updateResult, null, 2))
    
  } catch (error) {
    console.error('ERROR during zone position calculation:', error)
    console.error('Error details:', {
      message: error.message,
      stack: error.stack
    })
  }
}

// Run the test
testZoneACalculation().catch(console.error)