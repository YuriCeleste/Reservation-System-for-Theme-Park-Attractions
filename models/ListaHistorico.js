const ListaDuplamenteEncadeada = require('./ListaDuplamenteEncadeada');

class ListaHistorico extends ListaDuplamenteEncadeada {
  /** Todas as reservas de um visitante, em ordem decrescente de id (mais recentes primeiro). */
  porVisitante(visitanteId) {
    const resultado = [];
    for (let no = this.fim; no; no = no.anterior) {
      if (no.dado.visitante.id === visitanteId) resultado.push(no.dado);
    }
    return resultado;
  }

  /** Reservas aguardando de uma atração + horário, na ordem de chegada. */
  porAtracaoEHorario(atracaoId, horario) {
    const resultado = [];
    for (let no = this.inicio; no; no = no.proximo) {
      const r = no.dado;
      if (r.atracao.id === atracaoId && r.horario === horario && r.status === 'aguardando') {
        resultado.push(r);
      }
    }
    return resultado;
  }
}

module.exports = ListaHistorico;