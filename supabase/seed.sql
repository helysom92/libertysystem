-- Sistema Liberty — dev seed data (clientes + serviços only).
-- Auth users/profiles are NOT seeded here: create the 3 real staff accounts via the
-- Supabase Dashboard (Authentication → Add user) or `supabase.auth.admin.createUser`,
-- then set each profiles.role manually. See plan §7.

insert into clientes (nome, empresa, cidade, whatsapp) values
  ('Auto Center Bela Vista', 'Auto Center Bela Vista Ltda', 'Campo Grande', '5567999990001'),
  ('Padaria Pão de Ouro', null, 'Campo Grande', '5567999990002'),
  ('Studio Fit Academia', 'Studio Fit', 'Campo Grande', '5567999990003');

insert into servicos (cliente_id, cliente, descricao, valor, valor_pago, tipo, prazo, prioridade, financeiro_status)
select id, nome, 'Fachada em ACM', 12000, 0, 'medida_instalacao', current_date + 10, 'Alta', 'Orçado'
from clientes where nome = 'Auto Center Bela Vista';

insert into servicos (cliente_id, cliente, descricao, valor, valor_pago, tipo, prazo, prioridade, financeiro_status)
select id, nome, 'Adesivo de Vitrine', 3100, 0, 'simples', current_date + 5, 'Normal', 'Orçado'
from clientes where nome = 'Padaria Pão de Ouro';

insert into servicos (cliente_id, cliente, descricao, valor, valor_pago, tipo, prazo, prioridade, financeiro_status)
select id, nome, 'Banners e Placas', 6800, 1000, 'medida_sem_instalacao', current_date + 2, 'Normal', 'Aguardando sinal'
from clientes where nome = 'Studio Fit Academia';
