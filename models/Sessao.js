const Atracao = require('./Atracao');
const FilaVirtual = require('./FilaVirtual');

class Sessao {
  #atracao;
  #horario;
  #fila;

  constructor(atracao, horario) {
    if (!(atracao instanceof Atracao)) throw new Error('Sessao precisa de uma Atracao.');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(horario)) throw new Error('Horário no formato HH:MM.');

    this.#atracao = atracao;
    this.#horario = horario;
    this.#fila = new FilaVirtual();
  }

  // ---------- Identificação ----------

  chave() {
    return `${this.#atracao.id}|${this.#horario}`;
  }

  jaPassou() {
    const agora = new Date().toISOString().slice(11, 16);
    return this.#horario < agora;
  }

  capacidadeRestante() {
    return this.#atracao.capacidade - this.#fila.tamanho;
  }

  // ---------- Operações da fila (delegação) ----------

  enfileirar(reserva) {
    return this.#fila.enfileirar(reserva);
  }

  desenfileirar() {
    return this.#fila.desenfileirar();
  }

  posicaoDe(visitante) {
    return this.#fila.posicaoDe(visitante);
  }

  buscarPorVisitante(visitante) {
    return this.#fila.buscarPorVisitante(visitante);
  }

  sairDaFila(visitante) {
    return this.#fila.sairDaFila(visitante);
  }

  proximos(n) {
    return this.#fila.proximos(n);
  }

  // ---------- Getters ----------

  get atracao()  { return this.#atracao; }
  get horario()  { return this.#horario; }
  get fila()     { return this.#fila; }
  get tamanho()  { return this.#fila.tamanho; }
}

module.exports = Sessao;