const Ingresso = require('./ingresso');
const db = require('../db');

class Visitante {
  _nome;
  _cpf;
  _email;
  _nascimento;
  _ingresso;
  _cartaoBandeira;
  _cartaoFinal;

  id = null;

  constructor({ nome, cpf, email, nascimento, ingresso, cartao }) {
    if (!nome || !nome.trim()) throw new Error('Nome é obrigatório.');
    if (!email || !email.includes('@')) throw new Error('E-mail inválido.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nascimento)) throw new Error('Data de nascimento inválida.');
    if (nascimento > new Date().toISOString().slice(0, 10)) throw new Error('A data de nascimento não pode ser no futuro.');

    const cpfLimpo = (cpf || '').replace(/\D/g, '');
    if (!/^\d{11}$/.test(cpfLimpo)) throw new Error('O CPF deve ter exatamente 11 dígitos.');

    const ing = Ingresso.criar(ingresso || 'normal');

    let bandeira = null, final = null;
    if (ing.exigeCartao()) {
      const num = (cartao?.numero || '').replace(/\D/g, '');
      if (!/^\d{13,19}$/.test(num)) throw new Error('O ingresso VIP exige um cartão de crédito.');
      bandeira = ({ 4: 'Visa', 5: 'Mastercard' }[num[0]]) || 'Outro';
      final = num.slice(-4);
    }

    this._nome = nome.trim();
    this._cpf = cpfLimpo;
    this._email = email.trim();
    this._nascimento = nascimento;
    this._ingresso = ing;
    this._cartaoBandeira = bandeira;
    this._cartaoFinal = final;
  }

  idade() {
    const [y, m, d] = this._nascimento.split('-').map(Number);
    const t = new Date();
    return t.getFullYear() - y - (t < new Date(t.getFullYear(), m - 1, d) ? 1 : 0);
  }

  salvar() {
    const r = db.prepare(`
      INSERT INTO visitantes (nome, cpf, email, nascimento, ingresso, cartao_bandeira, cartao_final)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      this._nome, this._cpf, this._email, this._nascimento,
      this._ingresso.tipo, this._cartaoBandeira, this._cartaoFinal
    );
    this.id = r.lastInsertRowid;
    return this.id;
  }

  static buscar(id) {
    const row = db.prepare('SELECT * FROM visitantes WHERE id = ?').get(id);
    if (!row) return null;
    return Visitante._deRow(row);
  }

  static listar() {
    return db.prepare('SELECT * FROM visitantes ORDER BY nome').all()
      .map(row => Visitante._deRow(row));
  }

  static _deRow(row) {
    const v = Object.create(Visitante.prototype);
    v.id = row.id;
    v._nome = row.nome;
    v._cpf = row.cpf;
    v._email = row.email;
    v._nascimento = row.nascimento;
    v._ingresso = Ingresso.criar(row.ingresso);
    v._cartaoBandeira = row.cartao_bandeira;
    v._cartaoFinal = row.cartao_final;
    return v;
  }

  get nome()          { return this._nome; }
  get cpf()           { return this._cpf; }
  get email()         { return this._email; }
  get nascimento()    { return this._nascimento; }
  get ingresso()      { return this._ingresso; }
  get cartaoBandeira(){ return this._cartaoBandeira; }
  get cartaoFinal()   { return this._cartaoFinal; }
}

module.exports = Visitante;