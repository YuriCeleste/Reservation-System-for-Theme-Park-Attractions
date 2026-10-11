/**
 * Gerador de IDs sequenciais em memória.
 * Cada instância tem o seu próprio contador.
 */
class Contador {
  #proximo = 1;

  /** Devolve o próximo id e incrementa. */
  proximoId() {
    return this.#proximo++;
  }

  /** Última posição usada (útil para debug). */
  get ultimoId() {
    return this.#proximo - 1;
  }
}

module.exports = Contador;