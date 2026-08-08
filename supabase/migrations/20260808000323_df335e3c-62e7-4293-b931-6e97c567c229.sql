
-- (1) Ensure public-assets bucket exists
-- Note: create_bucket is handled by the dedicated tool, but let's check for existing ones or add policies
GRANT USAGE ON SCHEMA storage TO authenticated, service_role, anon;
GRANT ALL ON TABLE storage.buckets TO service_role;
GRANT SELECT ON TABLE storage.buckets TO anon, authenticated;
GRANT ALL ON TABLE storage.objects TO service_role;
GRANT SELECT ON TABLE storage.objects TO anon, authenticated;

-- (2) Policies for public assets
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Public Access to public-assets'
    ) THEN
        CREATE POLICY "Public Access to public-assets"
        ON storage.objects FOR SELECT
        TO anon, authenticated
        USING (bucket_id = 'public-assets');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Service Role Upload'
    ) THEN
        CREATE POLICY "Service Role Upload"
        ON storage.objects FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
    END IF;
END
$$;
