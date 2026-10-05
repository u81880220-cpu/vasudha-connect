create or replace function public.notify_complaint_status_change()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
 if new.status is distinct from old.status then
   insert into public.notifications(user_id,type,title,message,data)
   values
    (new.reporter_id,'system','Complaint status updated',
     'Your complaint is now: '||replace(new.status::text,'_',' '),
     jsonb_build_object('complaint_id',new.id,'job_id',new.job_id,'status',new.status));
   if new.against_user_id is distinct from new.reporter_id then
     insert into public.notifications(user_id,type,title,message,data)
     values
      (new.against_user_id,'system','Complaint status updated',
       'A complaint involving your account is now: '||replace(new.status::text,'_',' '),
       jsonb_build_object('complaint_id',new.id,'job_id',new.job_id,'status',new.status));
   end if;
 end if;
 return new;
end;
$$;
drop trigger if exists trg_complaint_status_notification on public.complaints;
create trigger trg_complaint_status_notification after update of status on public.complaints for each row execute function public.notify_complaint_status_change();
grant execute on function public.notify_complaint_status_change() to authenticated;