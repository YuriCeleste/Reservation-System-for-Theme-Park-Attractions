/**
 * Nó de uma lista duplamente encadeada.
 * Guarda um dado e as referências para o nó seguinte e o anterior.
 */
class No {
  constructor(dado) {
    this.dado = dado;
    this.proximo = null;
    this.anterior = null;
    this.lista = null; // lista dona do nó: preenchida e limpa pela própria lista (uso interno)
  }
}

module.exports = No;