DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'storage' AND tablename = 'objects') THEN
        DROP POLICY IF EXISTS "Public Access" ON storage.objects;
        CREATE POLICY "Public Access" ON storage.objects FOR SELECT TO public USING (bucket_id = 'public-assets');
    END IF;
END $$;