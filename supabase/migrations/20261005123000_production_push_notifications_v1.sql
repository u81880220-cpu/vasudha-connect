-- Production push notification delivery and event coverage.
-- Applied to Supabase project bbweclhmbzwmflijppoi.

alter table public.notifications add column if not exists push_sent_at timestamptz;
alter table public.notifications add column if not exists push_attempts integer not null default 0;
alter table public.notifications add column if not exists push_error text;

create or replace function public._create_notification_internal(
 p_user_id uuid,p_type notification_type,p_title text,p_message text,p_data jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin insert into public.notifications(user_id,type,title,message,data) values(p_user_id,p_type,p_title,p_message,coalesce(p_data,'{}'::jsonb)) returning id into v_id; return v_id; end; $$;
revoke all on function public._create_notification_internal(uuid,notification_type,text,text,jsonb) from public,anon,authenticated;

create or replace function public.create_notification(p_user_id uuid,p_type notification_type,p_title text,p_message text,p_data jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
begin if auth.uid() is null or auth.uid()<>p_user_id then raise exception 'not allowed'; end if; return public._create_notification_internal(p_user_id,p_type,p_title,p_message,p_data); end; $$;
revoke all on function public.create_notification(uuid,notification_type,text,text,jsonb) from anon;
grant execute on function public.create_notification(uuid,notification_type,text,text,jsonb) to authenticated;

create or replace function public.notify_message_created() returns trigger language plpgsql security definer set search_path=public as $$
declare c record; recipient uuid; begin select customer_id,professional_id into c from public.conversations where id=new.conversation_id; recipient:=case when new.sender_id=c.customer_id then c.professional_id else c.customer_id end; if recipient is not null then perform public._create_notification_internal(recipient,'message','New message','You have received a new message.',jsonb_build_object('conversation_id',new.conversation_id,'message_id',new.id)); end if; return new; end; $$;

create or replace function public.notify_service_request_created() returns trigger language plpgsql security definer set search_path=public as $$ begin if new.professional_id is not null then perform public._create_notification_internal(new.professional_id,'service_request','New service request','A customer has sent you a new service request.',jsonb_build_object('request_id',new.id)); end if; return new; end; $$;

create or replace function public.notify_quote_submitted() returns trigger language plpgsql security definer set search_path=public as $$ declare v_customer uuid; begin select customer_id into v_customer from public.service_requests where id=new.request_id; if v_customer is not null then perform public._create_notification_internal(v_customer,'quote','New quotation received','A professional has submitted a quotation for your request.',jsonb_build_object('request_id',new.request_id,'quote_id',new.id)); end if; return new; end; $$;

create or replace function public.notify_quote_accepted() returns trigger language plpgsql security definer set search_path=public as $$ begin if new.status='accepted' and old.status is distinct from new.status then perform public._create_notification_internal(new.professional_id,'quote','Quotation accepted','Your quotation has been accepted by the customer.',jsonb_build_object('request_id',new.request_id,'quote_id',new.id)); end if; return new; end; $$;

create or replace function public.notify_job_status_changed() returns trigger language plpgsql security definer set search_path=public as $$
declare recipient uuid; label text; begin if new.status is distinct from old.status then recipient:=case when auth.uid()=new.customer_id then new.professional_id when auth.uid()=new.professional_id then new.customer_id else null end; label:=replace(initcap(new.status::text),'_',' '); if recipient is not null then perform public._create_notification_internal(recipient,'job','Job status updated','Job status is now '||label||'.',jsonb_build_object('job_id',new.id,'status',new.status::text)); end if; end if; return new; end; $$;

create or replace function public.notify_job_review_created() returns trigger language plpgsql security definer set search_path=public as $$ begin perform public._create_notification_internal(new.professional_id,'review','New review received','A customer has reviewed your completed job.',jsonb_build_object('job_id',new.job_id,'review_id',new.id)); return new; end; $$;
drop trigger if exists trg_notify_job_review_created on public.job_reviews;
create trigger trg_notify_job_review_created after insert on public.job_reviews for each row execute function public.notify_job_review_created();

create or replace function public.notify_customer_review_created() returns trigger language plpgsql security definer set search_path=public as $$ begin perform public._create_notification_internal(new.customer_id,'review','New customer review received','A professional has reviewed your completed job.',jsonb_build_object('job_id',new.job_id,'review_id',new.id)); return new; end; $$;
drop trigger if exists trg_notify_customer_review_created on public.customer_job_reviews;
create trigger trg_notify_customer_review_created after insert on public.customer_job_reviews for each row execute function public.notify_customer_review_created();

create or replace function public.notify_complaint_event() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='INSERT' then perform public._create_notification_internal(new.against_user_id,'system','Complaint reported','A complaint has been submitted regarding a job.',jsonb_build_object('complaint_id',new.id,'job_id',new.job_id,'event','submitted'));
 elsif new.status is distinct from old.status then
  perform public._create_notification_internal(new.reporter_id,'system','Complaint status updated','Your complaint is now '||replace(initcap(new.status::text),'_',' ')||'.',jsonb_build_object('complaint_id',new.id,'job_id',new.job_id,'status',new.status::text,'event','status'));
  if new.status in ('upheld','dismissed','resolved') then perform public._create_notification_internal(new.against_user_id,'system','Complaint reviewed','A complaint involving you has been reviewed.',jsonb_build_object('complaint_id',new.id,'job_id',new.job_id,'status',new.status::text,'event','reviewed')); end if;
 end if; return new;
end; $$;
drop trigger if exists trg_notify_complaint_insert on public.complaints;
create trigger trg_notify_complaint_insert after insert on public.complaints for each row execute function public.notify_complaint_event();
drop trigger if exists trg_notify_complaint_status on public.complaints;
create trigger trg_notify_complaint_status after update of status on public.complaints for each row execute function public.notify_complaint_event();

create or replace function public.enqueue_push_for_notification() returns trigger language plpgsql security definer set search_path=public as $$
declare v_secret text; v_url text;
begin
 select decrypted_secret into v_secret from vault.decrypted_secrets where name='vasudha_push_internal_secret' limit 1;
 v_url:='https://bbweclhmbzwmflijppoi.supabase.co/functions/v1/send-push-notification';
 if v_secret is not null then perform net.http_post(url:=v_url,headers:=jsonb_build_object('Content-Type','application/json','x-vasudha-internal-secret',v_secret),body:=jsonb_build_object('notification_id',new.id)); end if;
 return new;
end; $$;
revoke all on function public.enqueue_push_for_notification() from public,anon,authenticated;
drop trigger if exists trg_enqueue_push_notification on public.notifications;
create trigger trg_enqueue_push_notification after insert on public.notifications for each row execute function public.enqueue_push_for_notification();