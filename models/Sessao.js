const Atracao = require('./Atracao');

class Sessao {
  #atracao;
  #horario;

  constructor(atracao, horario) {
    if (!(atracao instanceof Atracao)) throw new Error('Sessao precisa de uma Atracao.');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(horario)) throw new Error('Horário no formato HH:MM.');

    this.#atracao = atracao;
    this.#horario = horario;
  }

  chave() {
    return `${this.#atracao.id}|${this.#horario}`;
  }

  jaPassou() {
    const agora = new Date().toISOString().slice(11, 16);
    return this.#horario < agora;
  }

  capacidadeRestante(qtdNaFila) {
    return this.#atracao.capacidade - qtdNaFila;
  }

  get atracao() { return this.#atracao; }
  get horario() { return this.#horario; }
}

module.exports = Sessao;