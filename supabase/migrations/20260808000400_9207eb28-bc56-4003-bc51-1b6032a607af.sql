
-- Re-verify and strengthen policy for public-assets
DO $$
BEGIN
    -- Drop existing policy if any to be sure
    DROP POLICY IF EXISTS "Public Access to public-assets" ON storage.objects;
    
    -- Create policy allowing public SELECT on the specific bucket
    CREATE POLICY "Public Access to public-assets"
    ON storage.objects FOR SELECT
    TO anon, authenticated
    USING (bucket_id = 'public-assets');
END
$$;
