const path = require('path');

/** Arquivo do banco SQLite. Pode ser trocado com a variável de ambiente PARQUE_DB. */
module.exports = {
  ARQUIVO_DB: process.env.PARQUE_DB || path.join(__dirname, 'parque.db')
};