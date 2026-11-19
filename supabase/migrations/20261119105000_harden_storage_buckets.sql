-- =============================================================================
-- Migration: Harden Supabase Storage Buckets & Policies
--            - payment-proofs becomes private (requires signed URLs / auth)
--            - match-photos & venue-photos require group admin role
--            - reservation-proofs restricts path to valid reservation UUID
-- =============================================================================

BEGIN;

-- Make payment-proofs private so financial receipts are not publicly enumerable
UPDATE storage.buckets
SET public = false
WHERE id = 'payment-proofs';

-- Drop legacy overly-permissive storage policies
DROP POLICY IF EXISTS "admins delete match photos" ON storage.objects;
DROP POLICY IF EXISTS "admins update match photos" ON storage.objects;
DROP POLICY IF EXISTS "admins upload match photos" ON storage.objects;
DROP POLICY IF EXISTS "admins delete venue photos" ON storage.objects;
DROP POLICY IF EXISTS "admins update venue photos" ON storage.objects;
DROP POLICY IF EXISTS "admins upload venue photos" ON storage.objects;
DROP POLICY IF EXISTS "venue photos admin delete" ON storage.objects;
DROP POLICY IF EXISTS "venue photos admin update" ON storage.objects;
DROP POLICY IF EXISTS "venue photos admin upload" ON storage.objects;
DROP POLICY IF EXISTS "payment proofs delete owner" ON storage.objects;
DROP POLICY IF EXISTS "payment proofs insert authenticated" ON storage.objects;
DROP POLICY IF EXISTS "payment proofs public read" ON storage.objects;
DROP POLICY IF EXISTS "payment proofs update owner" ON storage.objects;
DROP POLICY IF EXISTS "reservation proofs insert" ON storage.objects;
DROP POLICY IF EXISTS "reservation proofs insert anon" ON storage.objects;
DROP POLICY IF EXISTS "reservation proofs public read" ON storage.objects;

-- 1. payment-proofs: authenticated owner or group admin ONLY (path: {paymentType}/{paymentId}/... or {uid}/...)
CREATE POLICY "payment_proofs_select_owner_or_admin" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND (
      owner = auth.uid()
      OR public.admin_for_profile_group(owner)
      OR EXISTS (
        SELECT 1
        FROM public.group_members gm
        WHERE gm.profile_id = auth.uid()
          AND gm.is_active = true
          AND gm.role IN ('admin', 'super_admin')
          AND (storage.foldername(name))[1] = gm.group_id::text
      )
      OR EXISTS (
        SELECT 1
        FROM public.match_fee_payments mfp
        WHERE mfp.proof_url LIKE '%' || storage.objects.name || '%'
          AND (mfp.profile_id = auth.uid() OR public.is_group_admin(mfp.group_id))
      )
      OR EXISTS (
        SELECT 1
        FROM public.collection_payments cp
        WHERE cp.proof_url LIKE '%' || storage.objects.name || '%'
          AND (cp.profile_id = auth.uid() OR public.is_group_admin(cp.group_id))
      )
    )
  );

CREATE POLICY "payment_proofs_insert_authenticated_scoped" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND owner = auth.uid()
  );

CREATE POLICY "payment_proofs_update_owner_only" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'payment-proofs' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'payment-proofs' AND owner = auth.uid());

CREATE POLICY "payment_proofs_delete_owner_only" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'payment-proofs' AND owner = auth.uid());

-- 2. match-photos: only admin of the match's group can upload/update/delete
CREATE POLICY "match_photos_admin_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'match-photos'
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id::text = (storage.foldername(name))[1]
        AND public.is_group_admin(m.group_id)
    )
  );

CREATE POLICY "match_photos_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'match-photos'
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id::text = (storage.foldername(name))[1]
        AND public.is_group_admin(m.group_id)
    )
  );

CREATE POLICY "match_photos_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'match-photos'
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id::text = (storage.foldername(name))[1]
        AND public.is_group_admin(m.group_id)
    )
  );

-- 3. venue-photos: only admin of the venue's group can upload/update/delete
CREATE POLICY "venue_photos_admin_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'venue-photos'
    AND EXISTS (
      SELECT 1 FROM public.venues v
      WHERE v.id::text = (storage.foldername(name))[1]
        AND public.is_group_admin(v.group_id)
    )
  );

CREATE POLICY "venue_photos_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'venue-photos'
    AND EXISTS (
      SELECT 1 FROM public.venues v
      WHERE v.id::text = (storage.foldername(name))[1]
        AND public.is_group_admin(v.group_id)
    )
  );

CREATE POLICY "venue_photos_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'venue-photos'
    AND EXISTS (
      SELECT 1 FROM public.venues v
      WHERE v.id::text = (storage.foldername(name))[1]
        AND public.is_group_admin(v.group_id)
    )
  );

-- 4. reservation-proofs: allow upload ONLY under an existing pending/confirmed reservation UUID folder
CREATE POLICY "reservation_proofs_select_authenticated_member" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'reservation-proofs'
    AND EXISTS (
      SELECT 1 FROM public.court_reservations r
      WHERE r.id::text = (storage.foldername(name))[1]
        AND public.is_group_member(r.group_id)
    )
  );

CREATE POLICY "reservation_proofs_insert_valid_reservation" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    bucket_id = 'reservation-proofs'
    AND EXISTS (
      SELECT 1 FROM public.court_reservations r
      WHERE r.id::text = (storage.foldername(name))[1]
        AND r.status IN ('pending', 'confirmed')
    )
  );

COMMIT;
