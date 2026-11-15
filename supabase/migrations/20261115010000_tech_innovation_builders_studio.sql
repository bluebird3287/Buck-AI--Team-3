-- Tech Innovation (Fisher): Builders Studio courses are offered Autumn and Spring (including Spring 2027), and a
-- student may take up to two in the same semester (the next studio concurrently with the one before it).
update requirement_courses set offered_terms = '{}'::text[], prerequisites = 'BUSADM 2802',
  notes = 'Autumn or Spring (offered Spring 2027); up to two Builders Studio courses may be taken in one semester'
  where group_id = 'ti-studio' and code = 'BUSADM 3801';
update requirement_courses set offered_terms = '{}'::text[], prerequisites = 'BUSADM 3801 (concurrent allowed)',
  notes = 'Autumn or Spring; may be taken with Builders Studio I in the same semester (two studios max per semester)'
  where group_id = 'ti-studio' and code = 'BUSADM 3802';
update requirement_courses set offered_terms = '{}'::text[], prerequisites = 'BUSADM 3802 (concurrent allowed)',
  notes = 'Autumn or Spring; may be taken with Builders Studio II in the same semester (two studios max per semester)'
  where group_id = 'ti-studio' and code = 'BUSADM 4803';
update requirement_courses set offered_terms = '{}'::text[], prerequisites = 'BUSADM 4803 (concurrent allowed)',
  notes = 'Autumn or Spring; may be taken with Builders Studio III in the same semester (two studios max per semester)'
  where group_id = 'ti-studio' and code = 'BUSADM 4804';
update programs set notes = replace(notes,
  'then one Builders Studio course each semester junior and senior year with corporate-sponsored projects.',
  'then Builders Studio courses (I-IV, in order) with corporate-sponsored projects: offered Autumn and Spring (including Spring 2027), and a student may take up to two in the same semester.')
  where id = 'spec-tech-innovation' or version_of = 'spec-tech-innovation';
