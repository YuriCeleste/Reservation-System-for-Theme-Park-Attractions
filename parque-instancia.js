/**
 * O Parque único da aplicação.
 *
 * As listas encadeadas guardam e operam os dados em memória; o SQLite só persiste. Ao ser carregado,
 * este módulo abre o banco e reconstrói as listas e as filas com o que estiver gravado.
 *
 * server.js e dados-exemplo.js usam ESTA mesma instância. O relógio lê a opção --sem-hora
 * (npm run demo / npm run seed): com ela, todos os horários ficam abertos.
 */
const Parque = require('./models/Parque');
const Relogio = require('./models/Relogio');
const RepositorioSqlite = require('./persistencia/RepositorioSqlite');
const { ARQUIVO_DB } = require('./config');

const relogio = new Relogio({ semHora: process.argv.includes('--sem-hora') });
const parque = new Parque(relogio, new RepositorioSqlite(ARQUIVO_DB));
parque.carregar();

module.exports = parque;