import { normalizarBusca } from "./texto";
import type { Cliente } from "./types";

export type ClienteParaCruzamento = Pick<Cliente, "id" | "nome" | "empresa" | "cpf_cnpj">;

export interface ClienteProvavel {
  clienteId: string;
  nome: string;
  motivo: string;
  pontos: number;
}

/** Palavras que aparecem em quase toda razão social e não identificam ninguém. */
const GENERICAS = new Set([
  "de", "da", "do", "das", "dos", "e", "ltda", "me", "epp", "eireli", "sa", "cia", "filho", "filha",
  "comercio", "servicos", "servico", "industria", "com", "para", "the",
]);

function tokens(texto: string): string[] {
  return normalizarBusca(texto)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !GENERICAS.has(t));
}

const soDigitos = (s: string) => s.replace(/\D/g, "");

/**
 * O Mercado Pago pode mandar o documento inteiro ("12345678000190") ou mascarado
 * ("***.456.789-**"). Devolve os dígitos completos (11/14) ou o maior trecho visível.
 */
export function documentoVisivel(documento: string | null | undefined): { completo: string | null; trecho: string } {
  const bruto = (documento ?? "").trim();
  if (!bruto) return { completo: null, trecho: "" };
  const apenas = soDigitos(bruto);
  if (!/[*xX•]/.test(bruto) && (apenas.length === 11 || apenas.length === 14)) return { completo: apenas, trecho: apenas };
  // Mascarado: separadores comuns não quebram um trecho de dígitos ("456.789" é um trecho só).
  const semSeparadores = bruto.replace(/[.\-/\s]/g, "");
  const trechos = semSeparadores.match(/\d+/g) ?? [];
  const maior = trechos.sort((a, b) => b.length - a.length)[0] ?? "";
  return { completo: null, trecho: maior };
}

/**
 * Sugere de qual cliente é o pagador, só como pergunta pro Administrador — nunca vincula
 * sozinho. Documento completo igual vale mais que tudo; trecho visível do documento e nome
 * parecido (palavras em comum, ignorando "ltda", "me", "de"…) complementam.
 */
export function sugerirClientes(
  textos: (string | null | undefined)[],
  documento: string | null | undefined,
  clientes: ClienteParaCruzamento[]
): ClienteProvavel[] {
  const doc = documentoVisivel(documento);
  const palavrasDoPagador = new Set(textos.filter(Boolean).flatMap((t) => tokens(t!)));
  const resultado: ClienteProvavel[] = [];

  for (const c of clientes) {
    const docCliente = soDigitos(c.cpf_cnpj ?? "");
    let pontos = 0;
    const motivos: string[] = [];

    if (doc.completo && docCliente && doc.completo === docCliente) {
      pontos += 100;
      motivos.push("CPF/CNPJ confere");
    } else if (doc.trecho.length >= 5 && docCliente.includes(doc.trecho)) {
      pontos += 60;
      motivos.push("parte do CPF/CNPJ confere");
    }

    const palavrasDoCliente = new Set([...tokens(c.nome), ...(c.empresa ? tokens(c.empresa) : [])]);
    if (palavrasDoPagador.size > 0 && palavrasDoCliente.size > 0) {
      const emComum = [...palavrasDoPagador].filter((p) => palavrasDoCliente.has(p));
      // Duas palavras em comum já são um sinal; uma só vale apenas quando os dois nomes são
      // de uma palavra só (uma palavra solta, tipo "Rodrigo", casaria com meio mundo).
      const nomesDeUmaPalavra = palavrasDoPagador.size === 1 && palavrasDoCliente.size === 1;
      if (emComum.length >= 2 || (emComum.length === 1 && nomesDeUmaPalavra)) {
        pontos += 40 + 5 * Math.min(emComum.length, 4);
        motivos.push("nome parecido");
      }
    }

    if (pontos > 0) {
      resultado.push({ clienteId: c.id, nome: c.empresa ? `${c.nome} (${c.empresa})` : c.nome, motivo: motivos.join(" + "), pontos });
    }
  }

  return resultado.sort((a, b) => b.pontos - a.pontos).slice(0, 3);
}
