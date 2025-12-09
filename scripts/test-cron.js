#!/usr/bin/env node

/**
 * Script per testare manualmente il cron job di scraping competitors
 * 
 * Usage:
 *   node scripts/test-cron.js [environment]
 * 
 * Environment:
 *   - production (default): https://revenuesentry.vercel.app
 *   - local: http://localhost:3000
 */

const https = require('https');
const http = require('http');

const CRON_SECRET = process.env.CRON_SECRET;

if (!CRON_SECRET) {
  console.error('❌ ERRORE: CRON_SECRET non trovato nelle variabili d\'ambiente');
  console.error('');
  console.error('Configura CRON_SECRET:');
  console.error('  export CRON_SECRET="3631ae8ce6c85b8e3662c75496d0c43ffcfa626278ee64883fabb54fd34e065e"');
  console.error('');
  console.error('Oppure crea un file .env.local con:');
  console.error('  CRON_SECRET=your_secret_here');
  process.exit(1);
}

const environment = process.argv[2] || 'production';
const baseUrl = environment === 'local' 
  ? 'http://localhost:3000'
  : 'https://revenuesentry.vercel.app';

const url = `${baseUrl}/api/cron/scrape-competitors`;

console.log('🚀 Test Cron Job - Scraping Competitors');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`📍 Environment: ${environment}`);
console.log(`🔗 URL: ${url}`);
console.log(`🔐 Secret: ${CRON_SECRET.substring(0, 10)}...`);
console.log('');
console.log('⏳ Avvio scraping...');
console.log('');

const startTime = Date.now();

const options = {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${CRON_SECRET}`,
    'Content-Type': 'application/json'
  }
};

const client = environment === 'local' ? http : https;

const req = client.request(url, options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    const duration = Date.now() - startTime;
    
    console.log(`📊 Status: ${res.statusCode} ${res.statusMessage}`);
    console.log('');

    try {
      const json = JSON.parse(data);
      
      if (res.statusCode === 200 && json.success) {
        console.log('✅ SUCCESS!');
        console.log('');
        console.log('📈 Risultati:');
        console.log(`   • Total competitor: ${json.results.total}`);
        console.log(`   • Success: ${json.results.success}`);
        console.log(`   • Failed: ${json.results.failed}`);
        console.log(`   • Hotels processati: ${json.results.hotelsProcessed}`);
        console.log(`   • Competitors processati: ${json.results.competitorsProcessed}`);
        console.log(`   • Durata: ${json.durationSeconds}s`);
        console.log('');

        if (json.results.errors && json.results.errors.length > 0) {
          console.log('⚠️  Errori:');
          json.results.errors.forEach((error, idx) => {
            console.log(`   ${idx + 1}. ${error}`);
          });
          console.log('');
        }

        console.log(`🕐 Timestamp: ${json.timestamp}`);
      } else {
        console.log('❌ ERRORE:');
        console.log(JSON.stringify(json, null, 2));
      }
    } catch (e) {
      console.log('❌ Errore parsing risposta:');
      console.log(data);
    }

    console.log('');
    console.log(`⏱️  Durata totale: ${Math.round(duration / 1000)}s`);
  });
});

req.on('error', (error) => {
  console.error('❌ Errore richiesta:', error.message);
  process.exit(1);
});

req.setTimeout(300000, () => { // 5 minuti timeout
  console.error('❌ Timeout: la richiesta ha impiegato più di 5 minuti');
  req.destroy();
  process.exit(1);
});

req.end();

