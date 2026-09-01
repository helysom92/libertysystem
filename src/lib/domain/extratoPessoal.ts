/**
 * Bloco E (importação) — tipo isolado do domínio empresarial (`extrato.ts`), mesmo formato de
 * uma linha de extrato lida por IA, mas nunca importado de lá: os dois módulos não compartilham
 * dado nem tipo específico de feature, só o padrão de forma.
 */
export interface LinhaExtratoPessoal {
  data: string; // "YYYY-MM-DD"
  descricao: string;
  valor: number; // sempre positivo
  tipo: "Receita" | "Despesa";
}
