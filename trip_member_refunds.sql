-- Run this migration before deploying the refund-status UI.
-- Records actual transfers FROM the common fund to members. Does not amend
-- expenses, contributions or the existing payment/reimbursement ledger.
create table if not exists public.trip_member_refunds (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  member_id uuid not null,
  amount numeric(16,0) not null check(amount > 0),
  paid_on date not null default (now() at time zone 'Asia/Ho_Chi_Minh')::date,
  note text not null default '' check(length(note) <= 250),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint trip_member_refunds_one_per_member unique(trip_id,member_id),
  constraint trip_member_refunds_member_fk
    foreign key(trip_id,member_id) references public.members(trip_id,user_id)
);
create index if not exists trip_member_refunds_trip_created on public.trip_member_refunds(trip_id,created_at desc);
alter table public.trip_member_refunds enable row level security;
drop policy if exists "trip refund read" on public.trip_member_refunds;
create policy "trip refund read" on public.trip_member_refunds for select to authenticated
 using(public.is_trip_member(trip_id) or exists(
  select 1 from public.trips t where t.id=trip_id and t.created_by=(select auth.uid())
 ));
drop policy if exists "trip refund record" on public.trip_member_refunds;
create policy "trip refund record" on public.trip_member_refunds for insert to authenticated
 with check(
  created_by=(select auth.uid()) and public.can_edit_trip(trip_id)
 );
drop policy if exists "trip refund undo" on public.trip_member_refunds;
create policy "trip refund undo" on public.trip_member_refunds for delete to authenticated
 using(public.can_edit_trip(trip_id));
-- No UPDATE policy: correct a wrong record by undoing it and re-recording.
revoke all on public.trip_member_refunds from public,anon,authenticated;
grant select,insert,delete on public.trip_member_refunds to authenticated;
drop trigger if exists audit_trip_member_refunds on public.trip_member_refunds;
create trigger audit_trip_member_refunds after insert or delete on public.trip_member_refunds
 for each row execute function public.log_trip_activity();
