const db = require('../db');

class Atracao {
  #nome;
  #tipo;
  #capacidade;
  #idadeMinima;
  #horarios;
  #filaVip;

  id = null;

  constructor({ nome, tipo, capacidade, idadeMinima, horarios, filaVip }) {
    if (!nome || !nome.trim()) throw new Error('Nome é obrigatório.');
    if (!(capacidade > 0)) throw new Error('Capacidade deve ser maior que zero.');
    if (idadeMinima < 0) throw new Error('Idade mínima não pode ser negativa.');

    let lista;
    if (typeof horarios === 'string') {
      lista = horarios.split(',').map(h => h.trim()).filter(Boolean);
    } else {
      lista = horarios || [];
    }
    if (!lista.length || !lista.every(h => /^([01]\d|2[0-3]):[0-5]\d$/.test(h))) {
      throw new Error('Horários no formato HH:MM, separados por vírgula.');
    }

    this.#nome = nome.trim();
    this.#tipo = tipo;
    this.#capacidade = +capacidade;
    this.#idadeMinima = +idadeMinima;
    this.#horarios = lista.sort();
    this.#filaVip = !!filaVip;
  }

  aceitaVip() {
    return this.#filaVip;
  }

  salvar() {
    const r = db.prepare(`
      INSERT INTO atracoes (nome, tipo, capacidade, idade_minima, horarios, vip)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      this.#nome, this.#tipo, this.#capacidade, this.#idadeMinima,
      this.#horarios.join(','), this.#filaVip ? 1 : 0
    );
    this.id = r.lastInsertRowid;
    return this.id;
  }

  static buscar(id) {
    const row = db.prepare('SELECT * FROM atracoes WHERE id = ?').get(id);
    if (!row) return null;
    return Atracao.#deRow(row);
  }

  static listar() {
    return db.prepare('SELECT * FROM atracoes ORDER BY nome').all()
      .map(row => Atracao.#deRow(row));
  }

  static #deRow(row) {
    const a = new Atracao({
      nome: row.nome,
      tipo: row.tipo,
      capacidade: row.capacidade,
      idadeMinima: row.idade_minima,
      horarios: row.horarios,
      filaVip: row.vip === 1
    });
    a.id = row.id;
    return a;
  }

  get nome()        { return this.#nome; }
  get tipo()        { return this.#tipo; }
  get capacidade()  { return this.#capacidade; }
  get idadeMinima() { return this.#idadeMinima; }
  get horarios()    { return this.#horarios; }
  get filaVip()     { return this.#filaVip; }
}

module.exports = Atracao;