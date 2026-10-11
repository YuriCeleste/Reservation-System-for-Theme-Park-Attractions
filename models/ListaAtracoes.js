const ListaDuplamenteEncadeada = require('./ListaDuplamenteEncadeada');

class ListaAtracoes extends ListaDuplamenteEncadeada {
  /** Busca por nome (case-insensitive). Devolve a Atracao ou null. */
  buscarPorNome(nome) {
    const alvo = (nome || '').trim().toLowerCase();
    const no = this.buscar(a => a.nome.toLowerCase() === alvo);
    return no ? no.dado : null;
  }
}

module.exports = ListaAtracoes;