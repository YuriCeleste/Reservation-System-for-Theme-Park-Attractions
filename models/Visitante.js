const Ingresso = require('./Ingresso');

class Visitante {
  #id;
  #nome;
  #cpf;
  #email;
  #nascimento;
  #ingresso;
  #cartaoBandeira = null;
  #cartaoFinal = null;

  /** O id é gerado pelo Parque. `hoje` ('AAAA-MM-DD') vem do Relogio; sem ele, usa o dia local. */
  constructor({ id, nome, cpf, email, nascimento, ingresso, cartao, hoje = Visitante.#hojeLocal() }) {
    if (id === undefined || id === null) throw new Error('Id é obrigatório (gerado pelo Parque).');
    if (!nome || !nome.trim()) throw new Error('Nome é obrigatório.');
    if (!email || !email.includes('@')) throw new Error('E-mail inválido.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nascimento)) throw new Error('Data de nascimento inválida.');
    if (nascimento > hoje) throw new Error('A data de nascimento não pode ser no futuro.');

    const cpfLimpo = (cpf || '').replace(/\D/g, '');
    if (!/^\d{11}$/.test(cpfLimpo)) throw new Error('O CPF deve ter exatamente 11 dígitos.');

    const tipoIngresso = Ingresso.criar(ingresso || 'normal');
    if (tipoIngresso.exigeCartao()) {
      const numero = (cartao?.numero || '').replace(/\D/g, '');
      if (!/^\d{13,19}$/.test(numero)) throw new Error('O ingresso VIP exige um cartão de crédito.');
      this.#cartaoBandeira = ({ 4: 'Visa', 5: 'Mastercard' }[numero[0]]) || 'Outro';
      this.#cartaoFinal = numero.slice(-4); // só os 4 últimos dígitos ficam guardados
    }

    this.#id = id;
    this.#nome = nome.trim();
    this.#cpf = cpfLimpo;
    this.#email = email.trim();
    this.#nascimento = nascimento;
    this.#ingresso = tipoIngresso;
  }

  /** Idade na data informada ('AAAA-MM-DD'); sem argumento, usa o dia local. */
  idade(hoje = Visitante.#hojeLocal()) {
    const [ano, mes, dia] = this.#nascimento.split('-').map(Number);
    const [anoHoje, mesHoje, diaHoje] = hoje.split('-').map(Number);
    const fezAniversario = mesHoje > mes || (mesHoje === mes && diaHoje >= dia);
    return anoHoje - ano - (fezAniversario ? 0 : 1);
  }

  static #hojeLocal() {
    return new Date().toLocaleDateString('sv'); // AAAA-MM-DD, no fuso local
  }

  get id()             { return this.#id; }
  get nome()           { return this.#nome; }
  get cpf()            { return this.#cpf; }
  get email()          { return this.#email; }
  get nascimento()     { return this.#nascimento; }
  get ingresso()       { return this.#ingresso; }
  get cartaoBandeira() { return this.#cartaoBandeira; }
  get cartaoFinal()    { return this.#cartaoFinal; }
}

module.exports = Visitante;