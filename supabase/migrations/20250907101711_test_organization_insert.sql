-- Test if we can insert into organizaciones table
INSERT INTO organizaciones (
  name,
  description, 
  phone,
  responsible_first_name,
  responsible_last_name,
  responsible_dni,
  responsible_position,
  is_active
) VALUES (
  'Test Organization',
  'Test Description',
  '+54911234567',
  'Test',
  'User',
  '12345678',
  'Admin',
  false
) RETURNING id;