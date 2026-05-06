/**
 * Script para debuggear el cálculo de posiciones de zona
 */

console.log('🔍 Debugging Zone A calculation...')

// Datos exactos de Zona A
const couples = [
  {
    id: '96facf19-6c3d-438d-944a-577b21ab527b', // Isabello/Jose
    player1: { first_name: 'Isabello', last_name: 'Politi', score: 100 },
    player2: { first_name: 'Jose', last_name: 'Politi', score: 100 }
  },
  {
    id: 'b9c2205d-74d4-421e-a15b-12a4b8513cce', // Luisito/Jejito  
    player1: { first_name: 'Luisito', last_name: 'Comunica', score: 100 },
    player2: { first_name: 'Jejito', last_name: 'Jose', score: 100 }
  },
  {
    id: 'ba33cead-ae69-45e2-b0ff-9fbe281d5303', // Iso/Prueba
    player1: { first_name: 'Iso', last_name: 'Pol', score: 100 },
    player2: { first_name: 'Prueba', last_name: 'Jejej', score: 100 }
  }
]

const matches = [
  {
    id: 'b59188b8-2c59-4b80-883c-f4a2b19dcb48',
    couple1_id: '96facf19-6c3d-438d-944a-577b21ab527b', // Isabello/Jose
    couple2_id: 'b9c2205d-74d4-421e-a15b-12a4b8513cce', // Luisito/Jejito
    result_couple1: '4',
    result_couple2: '6', 
    winner_id: 'b9c2205d-74d4-421e-a15b-12a4b8513cce', // Luisito/Jejito WINS
    status: 'FINISHED'
  },
  {
    id: 'f84e795b-4b40-4265-9d48-aee135065429',
    couple1_id: 'b9c2205d-74d4-421e-a15b-12a4b8513cce', // Luisito/Jejito
    couple2_id: 'ba33cead-ae69-45e2-b0ff-9fbe281d5303', // Iso/Prueba
    result_couple1: '6',
    result_couple2: '4',
    winner_id: 'b9c2205d-74d4-421e-a15b-12a4b8513cce', // Luisito/Jejito WINS
    status: 'FINISHED'
  },
  {
    id: '1a910bee-4dd2-47fa-9ddf-d6e00427f5fd',
    couple1_id: '96facf19-6c3d-438d-944a-577b21ab527b', // Isabello/Jose
    couple2_id: 'ba33cead-ae69-45e2-b0ff-9fbe281d5303', // Iso/Prueba
    result_couple1: '6',
    result_couple2: '4',
    winner_id: '96facf19-6c3d-438d-944a-577b21ab527b', // Isabello/Jose WINS
    status: 'FINISHED'
  }
]

console.log('📊 Expected Results:')
console.log('1. Luisito/Jejito: 2W-0L (1st place)')
console.log('2. Isabello/Jose: 1W-1L (2nd place)')  
console.log('3. Iso/Prueba: 0W-2L (3rd place)')
console.log('')

// Manual calculation
console.log('🧮 Manual Verification:')

couples.forEach(couple => {
  const name = `${couple.player1.first_name}/${couple.player2.first_name}`
  let wins = 0
  let losses = 0
  
  matches.forEach(match => {
    if (match.couple1_id === couple.id || match.couple2_id === couple.id) {
      if (match.winner_id === couple.id) {
        wins++
      } else {
        losses++
      }
    }
  })
  
  console.log(`${name}: ${wins}W-${losses}L`)
})
