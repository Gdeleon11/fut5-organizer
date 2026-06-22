-- Storage buckets migration
-- Run this in Supabase SQL Editor for new projects

-- 1. Avatars bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
ON CONFLICT (id) DO NOTHING;

-- 2. Match photos bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('match-photos', 'match-photos', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- 3. Venue photos bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('venue-photos', 'venue-photos', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- 4. Payment proofs bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('payment-proofs', 'payment-proofs', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
ON CONFLICT (id) DO NOTHING;

-- 5. RLS policies for avatars
DROP POLICY IF EXISTS "avatar images are publicly readable" ON storage.objects;
CREATE POLICY "avatar images are publicly readable"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "users upload own avatar" ON storage.objects;
CREATE POLICY "users upload own avatar"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "users update own avatar" ON storage.objects;
CREATE POLICY "users update own avatar"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "users delete own avatar" ON storage.objects;
CREATE POLICY "users delete own avatar"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 6. RLS policies for match-photos
DROP POLICY IF EXISTS "match photos are publicly readable" ON storage.objects;
CREATE POLICY "match photos are publicly readable"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'match-photos');

DROP POLICY IF EXISTS "admins upload match photos" ON storage.objects;
CREATE POLICY "admins upload match photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'match-photos');

DROP POLICY IF EXISTS "admins update match photos" ON storage.objects;
CREATE POLICY "admins update match photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'match-photos');

DROP POLICY IF EXISTS "admins delete match photos" ON storage.objects;
CREATE POLICY "admins delete match photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'match-photos');

-- 7. RLS policies for venue-photos
DROP POLICY IF EXISTS "venue photos public read" ON storage.objects;
CREATE POLICY "venue photos public read"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'venue-photos');

DROP POLICY IF EXISTS "admins upload venue photos" ON storage.objects;
CREATE POLICY "admins upload venue photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'venue-photos');

DROP POLICY IF EXISTS "admins update venue photos" ON storage.objects;
CREATE POLICY "admins update venue photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'venue-photos');

DROP POLICY IF EXISTS "admins delete venue photos" ON storage.objects;
CREATE POLICY "admins delete venue photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'venue-photos');

-- 8. RLS policies for payment-proofs
DROP POLICY IF EXISTS "payment proofs public read" ON storage.objects;
CREATE POLICY "payment proofs public read"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'payment-proofs');

DROP POLICY IF EXISTS "payment proofs insert authenticated" ON storage.objects;
CREATE POLICY "payment proofs insert authenticated"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payment-proofs');

DROP POLICY IF EXISTS "payment proofs update owner" ON storage.objects;
CREATE POLICY "payment proofs update owner"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'payment-proofs')
  WITH CHECK (bucket_id = 'payment-proofs');

DROP POLICY IF EXISTS "payment proofs delete owner" ON storage.objects;
CREATE POLICY "payment proofs delete owner"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'payment-proofs');
