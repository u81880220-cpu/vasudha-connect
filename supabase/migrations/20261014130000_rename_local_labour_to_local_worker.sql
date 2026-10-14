-- Rename the customer-facing category label without changing its stable slug or IDs.
update public.service_categories
set name = 'Local Worker'
where slug = 'local-labour'
  and name = 'Local Labour';
