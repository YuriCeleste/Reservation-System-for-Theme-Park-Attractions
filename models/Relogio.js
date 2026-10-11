/**
 * Relógio do parque. Injetável: o Parque recebe um Relogio e nunca lê a hora direto,
 * o que permite testar com hora fixa e manter o modo "npm run demo" (semHora).
 *
 * Formato das datas: 'AAAA-MM-DD HH:MM:SS' (hora local).
 */
class Relogio {
  #semHora;
  #fonte;

  /**
   * @param {object}   opcoes
   * @param {boolean}  opcoes.semHora  true = todos os horários ficam abertos (modo demo)
   * @param {Function} opcoes.fonte    devolve a data/hora atual no formato acima
   */
  constructor({ semHora = false, fonte = () => new Date().toLocaleString('sv') } = {}) {
    this.#semHora = semHora;
    this.#fonte = fonte;
  }

  /** Relógio parado em uma data/hora, útil nos testes. */
  static fixo(dataHora, semHora = false) {
    return new Relogio({ semHora, fonte: () => dataHora });
  }

  get semHora() { return this.#semHora; }

  agora() { return this.#fonte(); }                 // 2026-10-10 14:30:00
  hoje() { return this.agora().slice(0, 10); }      // 2026-10-10
  horaAtual() { return this.agora().slice(11, 16); } // 14:30

  /** Um horário 'HH:MM' ainda aceita entrada na fila? (sempre sim no modo demo) */
  horarioAberto(horario) {
    return this.#semHora || horario >= this.horaAtual();
  }
}

module.exports = Relogio;