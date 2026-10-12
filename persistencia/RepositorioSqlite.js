const Database = require('better-sqlite3');
const Repositorio = require('./Repositorio');

/**
 * Persistência em SQLite (banco relacional embutido: roda dentro da aplicação, sem servidor).
 *
 * Guarda e devolve objetos simples, no formato dos paraDados() das classes. Quem reconstrói as
 * listas encadeadas e as filas é o Parque (restaurar). As tabelas são as mesmas do db.js antigo,
 * então um parque.db antigo continua válido. Na tabela reservas, a coluna vip guarda a prioridade
 * da reserva (prioritaria).
 *
 * @param caminho arquivo do banco; use ':memory:' nos testes.
 */
class RepositorioSqlite extends Repositorio {
  #db;

  constructor(caminho = 'parque.db') {
    super();
    this.#db = new Database(caminho);
    this.#db.pragma('foreign_keys = ON');
    this.#db.exec(`
      CREATE TABLE IF NOT EXISTS atracoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, tipo TEXT NOT NULL,
        capacidade INTEGER NOT NULL, idade_minima INTEGER NOT NULL DEFAULT 0,
        horarios TEXT NOT NULL, vip INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS visitantes (
        id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, cpf TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE, nascimento TEXT NOT NULL, ingresso TEXT NOT NULL,
        cartao_bandeira TEXT, cartao_final TEXT);
      CREATE TABLE IF NOT EXISTS reservas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        visitante_id INTEGER NOT NULL REFERENCES visitantes(id),
        atracao_id INTEGER NOT NULL REFERENCES atracoes(id),
        horario TEXT NOT NULL, vip INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'aguardando',
        entrou_em TEXT NOT NULL, embarcou_em TEXT);
    `);
  }

  salvarAtracao(atracao) {
    const d = atracao.paraDados();
    this.#db.prepare(`INSERT INTO atracoes (id, nome, tipo, capacidade, idade_minima, horarios, vip)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(d.id, d.nome, d.tipo, d.capacidade, d.idadeMinima, d.horarios, d.filaVip ? 1 : 0);
  }

  salvarVisitante(visitante) {
    const d = visitante.paraDados();
    this.#db.prepare(`INSERT INTO visitantes (id, nome, cpf, email, nascimento, ingresso, cartao_bandeira, cartao_final)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(d.id, d.nome, d.cpf, d.email, d.nascimento, d.ingresso, d.cartao?.bandeira ?? null, d.cartao?.final ?? null);
  }

  salvarReserva(reserva) {
    const d = reserva.paraDados();
    this.#db.prepare(`INSERT INTO reservas (id, visitante_id, atracao_id, horario, vip, status, entrou_em, embarcou_em)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(d.id, d.visitanteId, d.atracaoId, d.horario, d.prioritaria ? 1 : 0, d.status, d.entrouEm, d.embarcouEm);
  }

  /** Cobre o embarque (status e embarcou_em) e a troca de horário (horario e entrou_em). */
  atualizarReserva(reserva) {
    const d = reserva.paraDados();
    const r = this.#db.prepare(`UPDATE reservas SET horario = ?, vip = ?, status = ?, entrou_em = ?, embarcou_em = ?
      WHERE id = ?`).run(d.horario, d.prioritaria ? 1 : 0, d.status, d.entrouEm, d.embarcouEm, d.id);
    if (r.changes === 0) throw new Error(`A reserva ${d.id} não existe no banco.`);
  }

  removerReserva(reserva) {
    const r = this.#db.prepare('DELETE FROM reservas WHERE id = ?').run(reserva.id);
    if (r.changes === 0) throw new Error(`A reserva ${reserva.id} não existe no banco.`);
  }

  /** Devolve { atracoes, visitantes, reservas } com objetos simples (arrays só nesta fronteira). */
  carregar() {
    const atracoes = this.#db.prepare('SELECT * FROM atracoes ORDER BY id').all().map(l => ({
      id: l.id, nome: l.nome, tipo: l.tipo, capacidade: l.capacidade,
      idadeMinima: l.idade_minima, horarios: l.horarios, filaVip: l.vip === 1
    }));
    const visitantes = this.#db.prepare('SELECT * FROM visitantes ORDER BY id').all().map(l => ({
      id: l.id, nome: l.nome, cpf: l.cpf, email: l.email, nascimento: l.nascimento, ingresso: l.ingresso,
      cartao: l.cartao_final ? { bandeira: l.cartao_bandeira, final: l.cartao_final } : null
    }));
    // Mais antigas primeiro (data/hora de entrada e depois id): a ordem em que as filas são refeitas.
    const reservas = this.#db.prepare('SELECT * FROM reservas ORDER BY entrou_em, id').all().map(l => ({
      id: l.id, visitanteId: l.visitante_id, atracaoId: l.atracao_id, horario: l.horario,
      prioritaria: l.vip === 1, status: l.status, entrouEm: l.entrou_em, embarcouEm: l.embarcou_em
    }));
    return { atracoes, visitantes, reservas };
  }

  /** Fecha a conexão com o banco. */
  fechar() {
    this.#db.close();
  }
}

module.exports = RepositorioSqlite;