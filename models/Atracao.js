const ListaDuplamenteEncadeada = require('./ListaDuplamenteEncadeada');
const Sessao = require('./Sessao');

const HORARIO = /^([01]\d|2[0-3]):[0-5]\d$/;

class Atracao {
  #id;
  #nome;
  #tipo;
  #capacidade;
  #idadeMinima;
  #filaVip;
  #sessoes = new ListaDuplamenteEncadeada(); // uma Sessao por horário, em ordem

  /** O id é gerado pelo Parque (contador). */
  constructor({ id, nome, tipo, capacidade, idadeMinima = 0, horarios, filaVip }) {
    if (id === undefined || id === null) throw new Error('Id é obrigatório (gerado pelo Parque).');
    if (!nome || !nome.trim()) throw new Error('Nome é obrigatório.');
    if (!(Number(capacidade) > 0)) throw new Error('Capacidade deve ser maior que zero.');
    if (!(Number(idadeMinima) >= 0)) throw new Error('Idade mínima não pode ser negativa.');

    // Aceita "09:00, 14:00" ou ['09:00', '14:00']. O array só serve para ler a entrada.
    const lista = typeof horarios === 'string'
      ? horarios.split(',').map(h => h.trim()).filter(Boolean)
      : [...(horarios || [])];
    if (!lista.length || !lista.every(h => HORARIO.test(h))) {
      throw new Error('Horários no formato HH:MM, separados por vírgula.');
    }
    lista.sort();

    this.#id = id;
    this.#nome = nome.trim();
    this.#tipo = tipo;
    this.#capacidade = Number(capacidade);
    this.#idadeMinima = Number(idadeMinima);
    this.#filaVip = !!filaVip;
    lista.forEach((h, i) => {
      if (h !== lista[i - 1]) this.#sessoes.inserirNoFim(new Sessao(h)); // ignora horário repetido
    });
  }

  /** Esta atração dá prioridade a esse visitante? (tem fila VIP e o ingresso tem prioridade) */
  concedePrioridadeA(visitante) {
    return this.#filaVip && visitante.ingresso.prioridade() > 0;
  }

  /** Devolve a Sessao do horário, ou null. */
  buscarSessao(horario) {
    const no = this.#sessoes.buscar(sessao => sessao.horario === horario);
    return no ? no.dado : null;
  }

  get id()          { return this.#id; }
  get nome()        { return this.#nome; }
  get tipo()        { return this.#tipo; }
  get capacidade()  { return this.#capacidade; }
  get idadeMinima() { return this.#idadeMinima; }
  get filaVip()     { return this.#filaVip; }
  get sessoes()     { return this.#sessoes; }
}

module.exports = Atracao;