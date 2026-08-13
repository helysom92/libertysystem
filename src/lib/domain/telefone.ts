const DDD_PADRAO = "67";

// Normaliza um WhatsApp digitado pro padrão "(67) 99854-8006": DDD junto do número (assume o
// DDD local — 67, Rio Brilhante/MS — quando o texto não trouxer nenhum) e o "9" adicional que
// todo celular brasileiro tem hoje. Se o texto não bater com um formato reconhecível (poucos ou
// muitos dígitos, por exemplo), devolve sem alterar — melhor não mexer do que estragar o que a
// pessoa digitou.
export function formatarWhatsapp(raw: string): string {
  const digitos = raw.replace(/\D/g, "");
  if (!digitos) return raw;

  let ddd: string;
  let local: string;
  if (digitos.length === 8 || digitos.length === 9) {
    ddd = DDD_PADRAO;
    local = digitos;
  } else if (digitos.length === 10 || digitos.length === 11) {
    ddd = digitos.slice(0, 2);
    local = digitos.slice(2);
  } else {
    return raw;
  }

  if (local.length === 8) {
    local = "9" + local;
  } else if (local.length !== 9 || local[0] !== "9") {
    return raw;
  }

  return `(${ddd}) ${local.slice(0, 5)}-${local.slice(5)}`;
}
