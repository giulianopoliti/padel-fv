/**
 * 🧪 SCRIPT SIMPLE PARA TESTING
 * 
 * Script que puedes ejecutar para probar la función de organizador
 * 
 * Para usar:
 * 1. npm run dev (para que el servidor esté corriendo)
 * 2. Abrir en el navegador: http://localhost:3000/api/test-organizador
 * 
 * O hacer requests específicos:
 * - http://localhost:3000/api/test-organizador?action=ids
 * - http://localhost:3000/api/test-organizador?action=single&playerId=xxx&tournamentId=xxx
 * - http://localhost:3000/api/test-organizador?action=info&tournamentId=xxx
 */

console.log(`
🧪 ===== TESTING DE ORGANIZADOR =====

Para probar la función de asignación de organizador:

1. 📋 Obtener IDs de prueba:
   GET http://localhost:3000/api/test-organizador?action=ids

2. 🔍 Test de jugador específico:
   GET http://localhost:3000/api/test-organizador?action=single&playerId=PLAYER_ID&tournamentId=TOURNAMENT_ID

3. 🏆 Info del torneo:
   GET http://localhost:3000/api/test-organizador?action=info&tournamentId=TOURNAMENT_ID

4. 🚀 Tests completos automáticos:
   GET http://localhost:3000/api/test-organizador

5. 🔄 Con opciones adicionales:
   GET http://localhost:3000/api/test-organizador?action=single&playerId=PLAYER_ID&tournamentId=TOURNAMENT_ID&force=true&handleClubId=true

===== EJEMPLOS DE USO =====

// En JavaScript (fetch)
fetch('http://localhost:3000/api/test-organizador?action=ids')
  .then(r => r.json())
  .then(console.log)

// En curl
curl "http://localhost:3000/api/test-organizador?action=ids"

===== NOTAS IMPORTANTES =====

✅ Los tests son SEGUROS - solo actualizan si el jugador NO tiene organizador
✅ Puedes ejecutar múltiples veces sin problema
✅ Revisa la consola del servidor para logs detallados
✅ Los datos se obtienen automáticamente de tu base de datos

=====================================
`)

// Si estás en Node.js y quieres hacer un test rápido:
if (typeof fetch !== 'undefined') {
  console.log('🚀 Ejecutando test automático...')
  
  fetch('http://localhost:3000/api/test-organizador?action=ids')
    .then(response => response.json())
    .then(data => {
      console.log('📋 IDs obtenidos:', data)
      
      // Si hay datos, hacer un test específico
      if (data.success && data.data.tournaments?.length && data.data.playersWithoutOrganizador?.length) {
        const tournament = data.data.tournaments[0]
        const player = data.data.playersWithoutOrganizador[0]
        
        console.log('🔍 Ejecutando test específico...')
        return fetch(`http://localhost:3000/api/test-organizador?action=single&playerId=${player.id}&tournamentId=${tournament.id}`)
      }
    })
    .then(response => response?.json())
    .then(result => {
      if (result) {
        console.log('✅ Test específico completado:', result)
      }
    })
    .catch(error => {
      console.log('ℹ️  Para ejecutar tests, inicia el servidor con "npm run dev" y visita las URLs mencionadas arriba')
    })
}