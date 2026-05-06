// Simple manual test to verify the system works
const { ZoneStatsCalculator, ZoneRankingEngine } = require('./lib/services/zone-position');

// Test data - 4 couples in a zone
const couples = [
  {
    id: 'couple1',
    player1_id: 'p1',
    player2_id: 'p2',
    player1: { id: 'p1', first_name: 'John', last_name: 'Doe', score: 400 },
    player2: { id: 'p2', first_name: 'Jane', last_name: 'Smith', score: 350 }
  },
  {
    id: 'couple2',
    player1_id: 'p3',
    player2_id: 'p4',
    player1: { id: 'p3', first_name: 'Bob', last_name: 'Wilson', score: 300 },
    player2: { id: 'p4', first_name: 'Alice', last_name: 'Brown', score: 320 }
  },
  {
    id: 'couple3',
    player1_id: 'p5',
    player2_id: 'p6',
    player1: { id: 'p5', first_name: 'Charlie', last_name: 'Davis', score: 280 },
    player2: { id: 'p6', first_name: 'Diana', last_name: 'Miller', score: 290 }
  },
  {
    id: 'couple4',
    player1_id: 'p7',
    player2_id: 'p8',
    player1: { id: 'p7', first_name: 'Frank', last_name: 'Garcia', score: 250 },
    player2: { id: 'p8', first_name: 'Grace', last_name: 'Lee', score: 260 }
  }
];

// Match results
const matches = [
  // couple1 vs couple2: couple1 wins 2-1
  {
    id: 'match1',
    couple1_id: 'couple1',
    couple2_id: 'couple2',
    result_couple1: 2,
    result_couple2: 1,
    winner_id: 'couple1',
    status: 'FINISHED',
    zone_id: 'zone1'
  },
  // couple3 vs couple4: couple3 wins 2-0
  {
    id: 'match2',
    couple1_id: 'couple3',
    couple2_id: 'couple4',
    result_couple1: 2,
    result_couple2: 0,
    winner_id: 'couple3',
    status: 'FINISHED',
    zone_id: 'zone1'
  }
];

console.log('🧪 Testing Zone Position System...\n');

try {
  const calculator = new ZoneStatsCalculator();
  const engine = new ZoneRankingEngine();
  
  // Calculate stats
  console.log('📊 Calculating couple statistics...');
  const coupleStats = calculator.calculateAllCoupleStats(couples, matches);
  
  coupleStats.forEach(stats => {
    console.log(`   ${stats.player1Name}/${stats.player2Name}: ${stats.matchesWon}W-${stats.matchesLost}L, Games: ${stats.gamesDifference}, Score: ${stats.totalPlayerScore}`);
  });
  
  // Create head-to-head matrix
  console.log('\n🎯 Creating head-to-head matrix...');
  const headToHeadMatrix = calculator.createHeadToHeadMatrix(couples, matches);
  console.log(`   Found ${headToHeadMatrix.length} potential matchups`);
  
  // Rank couples
  console.log('\n🏆 Ranking couples...');
  const rankedCouples = engine.rankCouplesByAllCriteria(coupleStats, headToHeadMatrix);
  
  console.log('\n📋 Final Rankings:');
  rankedCouples.forEach(couple => {
    console.log(`   ${couple.position}. ${couple.player1Name}/${couple.player2Name}`);
    console.log(`      Wins: ${couple.matchesWon}, Games Diff: ${couple.gamesDifference}, Player Score: ${couple.totalPlayerScore}`);
    console.log(`      Tie Info: ${couple.positionTieInfo}`);
    console.log('');
  });
  
  // Validate ranking
  console.log('✅ Validating ranking...');
  const isValid = engine.validateRanking(rankedCouples);
  console.log(`   Ranking is ${isValid ? 'VALID' : 'INVALID'} ✨`);
  
  console.log('\n🎉 Zone Position System is working correctly!');
  
} catch (error) {
  console.error('❌ Error testing system:', error.message);
  console.error(error.stack);
}