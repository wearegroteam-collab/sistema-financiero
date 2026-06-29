alter table public.users
alter column business_id drop not null;

update public.users
set business_id = null
where role = 'super_admin';

alter table public.users
drop constraint if exists business_required_for_business_roles;

alter table public.users
add constraint business_required_for_business_roles check (
  (role = 'super_admin' and business_id is null)
  or (role in ('admin', 'accountant') and business_id is not null)
);

alter table public.audit_logs
alter column business_id drop not null;

drop policy if exists "Admins manage payment methods" on public.payment_methods;
create policy "Admins manage payment methods" on public.payment_methods
for all using (business_id = public.current_business_id() and public.current_role() = 'admin')
with check (business_id = public.current_business_id() and public.current_role() = 'admin');

drop policy if exists "Admins manage categories" on public.categories;
create policy "Admins manage categories" on public.categories
for all using (business_id = public.current_business_id() and public.current_role() = 'admin')
with check (business_id = public.current_business_id() and public.current_role() = 'admin');

drop policy if exists "Admins manage settings" on public.settings;
create policy "Admins manage settings" on public.settings
for all using (business_id = public.current_business_id() and public.current_role() = 'admin')
with check (business_id = public.current_business_id() and public.current_role() = 'admin');
