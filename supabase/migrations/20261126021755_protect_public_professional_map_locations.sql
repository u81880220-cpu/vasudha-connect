do $migration$
declare
  v record;
  v_definition text;
  v_changed text;
begin
  for v in
    select p.oid, p.pronargs, p.oid::regprocedure::text as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'nearby_professionals_map'
      and p.pronargs in (4, 5)
  loop
    v_definition := pg_get_functiondef(v.oid);

    if v.pronargs = 5 then
      if position('round(m.distance::numeric,2),' in v_definition) = 0
         or position('m.latitude,' in v_definition) = 0
         or position('m.longitude,' in v_definition) = 0 then
        raise exception 'Unexpected 5-argument function definition: %', v.signature;
      end if;
      v_changed := replace(v_definition,
        'round(m.distance::numeric,2),',
        'round(m.distance::numeric,0),');
      v_changed := replace(v_changed,
        'm.latitude,',
        'round(m.latitude::numeric,2),');
      v_changed := replace(v_changed,
        'm.longitude,',
        'round(m.longitude::numeric,2),');
    else
      if position('round(b.distance::numeric, 2),' in v_definition) = 0
         or position('b.latitude,' in v_definition) = 0
         or position('b.longitude,' in v_definition) = 0 then
        raise exception 'Unexpected 4-argument function definition: %', v.signature;
      end if;
      v_changed := replace(v_definition,
        'round(b.distance::numeric, 2),',
        'round(b.distance::numeric, 0),');
      v_changed := replace(v_changed,
        'b.latitude,',
        'round(b.latitude::numeric, 2),');
      v_changed := replace(v_changed,
        'b.longitude,',
        'round(b.longitude::numeric, 2),');
    end if;

    if v_changed = v_definition then
      raise exception 'Privacy migration made no change to %', v.signature;
    end if;
    execute v_changed;
  end loop;
end
$migration$;
