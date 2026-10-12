/**
 * Contrato da persistência do parque. O Parque guarda e opera os dados nas listas encadeadas;
 * o repositório só os grava e os devolve quando o sistema é iniciado.
 *
 * Os dados trocados são objetos simples, no formato dos métodos paraDados() das classes
 * (Atracao, Visitante e Reserva). Implementações: SemPersistencia e RepositorioSqlite.
 */
class Repositorio {
  salvarAtracao(atracao) { Repositorio.#naoImplementado('salvarAtracao'); }
  salvarVisitante(visitante) { Repositorio.#naoImplementado('salvarVisitante'); }
  salvarReserva(reserva) { Repositorio.#naoImplementado('salvarReserva'); }

  /** A reserva já existe e mudou (embarcou ou trocou de horário). */
  atualizarReserva(reserva) { Repositorio.#naoImplementado('atualizarReserva'); }

  /** A reserva deixou de existir (o visitante saiu da fila). */
  removerReserva(reserva) { Repositorio.#naoImplementado('removerReserva'); }

  /** Devolve { atracoes: [...], visitantes: [...], reservas: [...] } com objetos simples. */
  carregar() { Repositorio.#naoImplementado('carregar'); }

  static #naoImplementado(metodo) {
    throw new Error(`${metodo}() precisa ser implementado pelo repositório.`);
  }
}

module.exports = Repositorio;