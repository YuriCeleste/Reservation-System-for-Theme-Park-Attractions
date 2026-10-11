const Visitante = require('./Visitante');
const Atracao = require('./Atracao');

const HORARIO = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATA_HORA = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

/** Um lugar de um visitante na fila de uma sessão (e, depois, no histórico). */
class Reserva {
  #id;
  #visitante;
  #atracao;
  #horario;
  #prioritaria;
  #entrouEm;
  #embarcouEm = null;
  #status = 'aguardando';

  /** id e entrouEm vêm do Parque (contador e Relogio); prioritaria é o que a FilaVirtual lê. */
  constructor({ id, visitante, atracao, horario, prioritaria, entrouEm }) {
    if (id === undefined || id === null) throw new Error('Id é obrigatório (gerado pelo Parque).');
    if (!(visitante instanceof Visitante)) throw new Error('Reserva precisa de um Visitante.');
    if (!(atracao instanceof Atracao)) throw new Error('Reserva precisa de uma Atracao.');
    if (!HORARIO.test(horario)) throw new Error('Horário no formato HH:MM.');
    if (!DATA_HORA.test(entrouEm)) throw new Error('Data/hora de entrada inválida.');

    this.#id = id;
    this.#visitante = visitante;
    this.#atracao = atracao;
    this.#horario = horario;
    this.#prioritaria = !!prioritaria;
    this.#entrouEm = entrouEm;
  }

  /** Registra o embarque na data/hora informada (vem do Relogio). */
  concluir(dataHora) {
    if (this.#status === 'concluida') throw new Error('Esta reserva já foi concluída.');
    if (!DATA_HORA.test(dataHora)) throw new Error('Data/hora de embarque inválida.');
    this.#status = 'concluida';
    this.#embarcouEm = dataHora;
  }

  get id()          { return this.#id; }
  get visitante()   { return this.#visitante; }
  get atracao()     { return this.#atracao; }
  get horario()     { return this.#horario; }
  get prioritaria() { return this.#prioritaria; }
  get entrouEm()    { return this.#entrouEm; }
  get embarcouEm()  { return this.#embarcouEm; }
  get status()      { return this.#status; }
}

module.exports = Reserva;