do $$
declare r record;
begin
  for r in
    select quote_ident(schemaname)||'.'||quote_ident(tablename) as fq
    from pg_tables
    where schemaname='public'
  loop
    execute 'revoke insert, update, delete, truncate, references, trigger on '||r.fq||' from anon';
  end loop;
end $$;
