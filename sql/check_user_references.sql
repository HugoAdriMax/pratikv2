-- Requête pour identifier les références à l'utilisateur
SELECT 
  conrelid::regclass AS table_name,
  confrelid::regclass AS referenced_table,
  conname AS constraint_name,
  pg_get_constraintdef(c.oid) AS constraint_definition
FROM pg_constraint c
JOIN pg_class cl ON c.conrelid = cl.oid
WHERE contype = 'f' AND cl.relname = 'users';
