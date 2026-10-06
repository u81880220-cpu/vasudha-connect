update public.app_settings
set value='true'::jsonb,updated_at=now()
where key='connection_payment_test_mode';
