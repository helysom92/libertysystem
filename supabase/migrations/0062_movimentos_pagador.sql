-- Dados do pagador entregues pelo Mercado Pago (nome da conta, banco, CPF/CNPJ quando vier,
-- e-mail e o objeto original) — base pra ligar o Pix ao cliente e mostrar o NOME DA CONTA em
-- destaque (o banco fica como informação secundária). Só admin/secretaria leem (RLS da tabela).
alter table mercadopago_movimentos add column if not exists pagador jsonb;
