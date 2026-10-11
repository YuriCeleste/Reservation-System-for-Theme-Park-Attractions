const FilaVirtual = require('./FilaVirtual');

const HORARIO = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Um horário de uma atração, com a sua própria fila virtual. */
class Sessao {
  #horario;
  #fila = new FilaVirtual();

  constructor(horario) {
    if (!HORARIO.test(horario)) throw new Error('Horário no formato HH:MM.');
    this.#horario = horario;
    this.#fila = new FilaVirtual();
  }

  get horario() { return this.#horario; }
  get fila() { return this.#fila; }
}

module.exports = Sessao;