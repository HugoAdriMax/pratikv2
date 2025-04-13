SELECT * FROM pg_catalog.pg_tables WHERE schemaname = 'public' AND tablename = 'services';
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'services';
