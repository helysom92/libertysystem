export interface CnpjLookupResult {
  nome: string;
  cidade: string | null;
  endereco: string | null;
  telefone: string | null;
}

/**
 * Free, no-auth CNPJ lookup via BrasilAPI (aggregates the public "minha-receita" data).
 * Data can be stale — this is a convenience auto-fill, not authoritative (see plan §2).
 */
export async function lookupCnpj(cnpj: string): Promise<CnpjLookupResult | null> {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return null;

  const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
  if (!res.ok) return null;

  const data = await res.json();
  const logradouro = [data.descricao_tipo_de_logradouro, data.logradouro, data.numero]
    .filter(Boolean)
    .join(" ");
  const bairro = data.bairro ? `, ${data.bairro}` : "";

  return {
    nome: data.nome_fantasia || data.razao_social || "",
    cidade: data.municipio || null,
    endereco: logradouro ? `${logradouro}${bairro}` : null,
    telefone: data.ddd_telefone_1 || null,
  };
}
