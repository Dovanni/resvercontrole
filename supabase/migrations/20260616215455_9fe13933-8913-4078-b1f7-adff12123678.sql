
-- Anyone can read these buckets
CREATE POLICY "public read product-photos" ON storage.objects FOR SELECT
  USING (bucket_id = 'product-photos');
CREATE POLICY "public read company-logos" ON storage.objects FOR SELECT
  USING (bucket_id = 'company-logos');

-- Authenticated users manage their own folder (path starts with their uid)
CREATE POLICY "users upload own product-photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "users update own product-photos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "users delete own product-photos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "users upload own company-logos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'company-logos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "users update own company-logos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'company-logos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "users delete own company-logos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'company-logos' AND auth.uid()::text = (storage.foldername(name))[1]);
