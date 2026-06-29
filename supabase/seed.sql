insert into public.businesses (id, name, currency, timezone, active, admin_name, admin_email)
values ('00000000-0000-0000-0000-000000000001', 'Hangar', 'COP', 'America/Bogota', true, 'Super Admin', 'admin@hangar.local')
on conflict do nothing;

insert into public.payment_methods (business_id, key, label, color)
values
  ('00000000-0000-0000-0000-000000000001', 'bold', 'BOLD', '#2563eb'),
  ('00000000-0000-0000-0000-000000000001', 'bancolombia', 'Bancolombia', '#eab308'),
  ('00000000-0000-0000-0000-000000000001', 'nequi', 'Nequi', '#8b5cf6'),
  ('00000000-0000-0000-0000-000000000001', 'cash', 'Efectivo', '#178047')
on conflict do nothing;

insert into public.categories (business_id, key, label, color)
values
  ('00000000-0000-0000-0000-000000000001', 'payroll', 'Nomina', '#c13d3a'),
  ('00000000-0000-0000-0000-000000000001', 'inventory', 'Inventario', '#ea580c'),
  ('00000000-0000-0000-0000-000000000001', 'extras', 'Extras', '#b7791f'),
  ('00000000-0000-0000-0000-000000000001', 'fixed', 'Gastos Fijos', '#475569')
on conflict do nothing;
