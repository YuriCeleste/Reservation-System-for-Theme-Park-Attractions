const Repositorio = require('../persistencia/Repositorio');

/** Não grava nada e não devolve nada: o parque vive só na memória (padrão do Parque e dos testes). */
class SemPersistencia extends Repositorio {
  salvarAtracao() {}
  salvarVisitante() {}
  salvarReserva() {}
  atualizarReserva() {}
  removerReserva() {}
  carregar() { return { atracoes: [], visitantes: [], reservas: [] }; }
}

module.exports = SemPersistencia;