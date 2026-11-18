create or replace function public.process_professional_subscription_expiry_reminders()
returns integer language plpgsql security definer set search_path=public as $$
declare r record; v_count integer:=0; v_days integer;
begin
 for r in select s.id,s.professional_id,s.current_period_end from public.professional_subscriptions s
  where s.status='active' and s.current_period_end is not null
   and (s.current_period_end::date-(now() at time zone 'Asia/Kolkata')::date) in (7,3,1)
 loop
  v_days:=r.current_period_end::date-(now() at time zone 'Asia/Kolkata')::date;
  if not exists(select 1 from public.notifications n where n.user_id=r.professional_id
   and n.data->>'subscription_expiry_reminder'='true' and n.data->>'subscription_id'=r.id::text
   and n.data->>'days_remaining'=v_days::text) then
   insert into public.notifications(user_id,type,title,message,data) values(r.professional_id,'system'::public.notification_type,
    case when v_days=1 then 'Your subscription expires tomorrow' else 'Your subscription expires in '||v_days||' days' end,
    case when v_days=1 then 'Renew your KAMPRO professional subscription today to continue receiving customer enquiries.'
     else 'Your KAMPRO professional subscription is due to expire in '||v_days||' days. Renew now to continue receiving customer enquiries.' end,
    jsonb_build_object('subscription_expiry_reminder',true,'subscription_id',r.id,'days_remaining',v_days,'screen','notifications','delivery_channel','both','category','subscription'));
   v_count:=v_count+1;
  end if;
 end loop; return v_count;
end; $$;
revoke all on function public.process_professional_subscription_expiry_reminders() from public,anon,authenticated;
select cron.schedule('kampro-professional-subscription-expiry-reminders','30 4 * * *','select public.process_professional_subscription_expiry_reminders();');
