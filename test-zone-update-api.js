/**
 * Script temporal para probar la recalculación de posiciones de zona via API
 */

console.log('🔧 Testing zone positions update via API...')

async function testZoneUpdateAPI() {
  try {
    const tournamentId = 'cc94fef0-48f0-4987-9613-99c960ece12c'
    const zoneId = '408258cc-93e8-4dda-8b4c-79fce8164af1' // Zona C
    
    console.log(`📊 Testing zone positions API for tournament ${tournamentId}, zone ${zoneId}`)
    
    // Llamar al API directamente
    const response = await fetch(`http://localhost:3002/api/tournaments/${tournamentId}/zone-positions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        zoneId: zoneId,
        forceRecalculate: true
      })
    })
    
    const result = await response.json()
    
    console.log('📈 API Response Status:', response.status)
    console.log('📈 API Result:', result)
    
    if (response.ok && result.success) {
      console.log('✅ Zone positions updated successfully via API!')
      console.log(`📊 Positions saved: ${result.data?.savedPositions || 0}`)
    } else {
      console.log('❌ API call failed:', result.error || 'Unknown error')
    }
    
  } catch (error) {
    console.error('💥 Error testing zone update via API:', error)
    console.error('Stack:', error.stack)
  }
}

testZoneUpdateAPI().then(() => {
  console.log('🏁 API Test completed')
  process.exit(0)
}).catch(error => {
  console.error('💥 API Test failed:', error)
  process.exit(1)
})