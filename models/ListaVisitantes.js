const ListaDuplamenteEncadeada = require('./ListaDuplamenteEncadeada');

class ListaVisitantes extends ListaDuplamenteEncadeada {
  /** Busca por CPF (11 dígitos, sem máscara). Devolve o Visitante ou null. */
  buscarPorCpf(cpf) {
    const alvo = (cpf || '').replace(/\D/g, '');
    const no = this.buscar(v => v.cpf === alvo);
    return no ? no.dado : null;
  }

  /** Busca por e-mail (case-insensitive). Devolve o Visitante ou null. */
  buscarPorEmail(email) {
    const alvo = (email || '').trim().toLowerCase();
    const no = this.buscar(v => v.email.toLowerCase() === alvo);
    return no ? no.dado : null;
  }
}

module.exports = ListaVisitantes;