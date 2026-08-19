-- Cache da última sugestão de IA por serviço — evita pagar de novo pela mesma resposta se o
-- usuário clicar no botão sem mudar nada (mesma descrição e mesmo valor calculado).
alter table servicos add column if not exists sugestao_ia_texto text;
alter table servicos add column if not exists sugestao_ia_valor numeric(12,2);
alter table servicos add column if not exists sugestao_ia_descricao text;
