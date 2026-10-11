const db = require('../db');
const Visitante = require('./visitante');
const Atracao = require('./atracao');

class Reserva {
  #visitante;
  #atracao;
  #horario;
  #entrouEm;
  #embarcouEm;
  #status;
  #vip;

  id = null;

  constructor({ visitante, atracao, horario, entrouEm, embarcouEm, status, vip }) {
    if (!(visitante instanceof Visitante)) throw new Error('Reserva precisa de um Visitante.');
    if (!(atracao instanceof Atracao)) throw new Error('Reserva precisa de uma Atracao.');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(horario)) throw new Error('Horário no formato HH:MM.');
    if (status && !['aguardando', 'concluida'].includes(status)) {
      throw new Error('Status deve ser "aguardando" ou "concluida".');
    }

    this.#visitante = visitante;
    this.#atracao = atracao;
    this.#horario = horario;
    this.#entrouEm = entrouEm || new Date().toLocaleString('sv');
    this.#embarcouEm = embarcouEm || null;
    this.#status = status || 'aguardando';
    this.#vip = !!vip;
  }

  embarcar() {
    this.#status = 'concluida';
    this.#embarcouEm = new Date().toLocaleString('sv');
  }

  salvar() {
    const r = db.prepare(`
      INSERT INTO reservas (visitante_id, atracao_id, horario, vip, entrou_em, embarcou_em, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      this.#visitante.id, this.#atracao.id, this.#horario,
      this.#vip ? 1 : 0, this.#entrouEm, this.#embarcouEm, this.#status
    );
    this.id = r.lastInsertRowid;
    return this.id;
  }

  static buscar(id) {
    const row = db.prepare('SELECT * FROM reservas WHERE id = ?').get(id);
    if (!row) return null;
    return Reserva.#deRow(row);
  }

  static porAtracaoEHorario(atracaoId, horario) {
    return db.prepare(`
      SELECT * FROM reservas
      WHERE atracao_id = ? AND horario = ? AND status = 'aguardando'
      ORDER BY id
    `).all(atracaoId, horario).map(row => Reserva.#deRow(row));
  }

  static porVisitante(visitanteId) {
    return db.prepare('SELECT * FROM reservas WHERE visitante_id = ? ORDER BY id DESC')
      .all(visitanteId).map(row => Reserva.#deRow(row));
  }

  static #deRow(row) {
    const r = new Reserva({
      visitante: Visitante.buscar(row.visitante_id),
      atracao: Atracao.buscar(row.atracao_id),
      horario: row.horario,
      entrouEm: row.entrou_em,
      embarcouEm: row.embarcou_em,
      status: row.status,
      vip: row.vip === 1
    });
    r.id = row.id;
    return r;
  }

  get visitante()  { return this.#visitante; }
  get atracao()    { return this.#atracao; }
  get horario()    { return this.#horario; }
  get entrouEm()   { return this.#entrouEm; }
  get embarcouEm() { return this.#embarcouEm; }
  get status()     { return this.#status; }
  get vip()        { return this.#vip; }
}

module.exports = Reserva;