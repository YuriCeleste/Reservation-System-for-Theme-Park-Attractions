/**
 * O Parque único da aplicação (em memória).
 *
 * server.js e dados-exemplo.js precisam usar ESTA mesma instância, senão os dados de exemplo
 * ficam em um parque e o servidor mostra outro. O relógio lê a opção --sem-hora (npm run demo).
 */
const Parque = require('./models/Parque');
const Relogio = require('./models/Relogio');

module.exports = new Parque(new Relogio({ semHora: process.argv.includes('--sem-hora') }));