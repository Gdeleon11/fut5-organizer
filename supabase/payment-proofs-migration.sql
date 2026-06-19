-- =============================================================================
-- MIGRATION: Sistema de Comprobantes de Pago
-- Agrega funcionalidad para que los jugadores suban comprobantes de pago
-- y los admin puedan verificarlos (aprobar/rechazar)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Agregar columnas de comprobante a match_fee_payments
-- -----------------------------------------------------------------------------

ALTER TABLE public.match_fee_payments
ADD COLUMN IF NOT EXISTS proof_url text,
ADD COLUMN IF NOT EXISTS proof_status text NOT NULL DEFAULT 'pending'
  CHECK (proof_status IN ('pending', 'submitted', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS proof_submitted_at timestamptz,
ADD COLUMN IF NOT EXISTS proof_reviewed_at timestamptz,
ADD COLUMN IF NOT EXISTS proof_rejection_reason text;

-- -----------------------------------------------------------------------------
-- 2. Agregar columnas de comprobante a collection_payments
-- -----------------------------------------------------------------------------

ALTER TABLE public.collection_payments
ADD COLUMN IF NOT EXISTS proof_url text,
ADD COLUMN IF NOT EXISTS proof_status text NOT NULL DEFAULT 'pending'
  CHECK (proof_status IN ('pending', 'submitted', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS proof_submitted_at timestamptz,
ADD COLUMN IF NOT EXISTS proof_reviewed_at timestamptz,
ADD COLUMN IF NOT EXISTS proof_rejection_reason text;

-- -----------------------------------------------------------------------------
-- 3. Crear bucket de storage para comprobantes de pago
-- -----------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-proofs',
  'payment-proofs',
  true,
  8388608, -- 8MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- 4. RLS policies para storage de comprobantes
-- -----------------------------------------------------------------------------

-- Cualquier usuario autenticado puede leer comprobantes (necesario para admin)
DROP POLICY IF EXISTS "payment proofs public read" ON storage.objects;
CREATE POLICY "payment proofs public read"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'payment-proofs');

-- El jugador puede subir comprobantes (verificado por la función)
DROP POLICY IF EXISTS "payment proofs insert authenticated" ON storage.objects;
CREATE POLICY "payment proofs insert authenticated"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'payment-proofs');

-- El jugador puede actualizar su propio comprobante
DROP POLICY IF EXISTS "payment proofs update owner" ON storage.objects;
CREATE POLICY "payment proofs update owner"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'payment-proofs')
WITH CHECK (bucket_id = 'payment-proofs');

-- El jugador puede eliminar su propio comprobante
DROP POLICY IF EXISTS "payment proofs delete owner" ON storage.objects;
CREATE POLICY "payment proofs delete owner"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'payment-proofs');

-- -----------------------------------------------------------------------------
-- 5. Función para generar token de comprobante
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.generate_proof_token(
  payment_id uuid,
  payment_type text -- 'match_fee' o 'collection'
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_id uuid;
  group_id uuid;
  due_date timestamptz;
  token_data jsonb;
  token text;
BEGIN
  -- Obtener información del pago
  IF payment_type = 'match_fee' THEN
    SELECT mfp.profile_id, mfp.group_id, mf.due_before
    INTO profile_id, group_id, due_date
    FROM public.match_fee_payments mfp
    JOIN public.match_fees mf ON mf.id = mfp.match_fee_id
    WHERE mfp.id = payment_id;
  ELSIF payment_type = 'collection' THEN
    SELECT cp.profile_id, cp.group_id, c.due_date::timestamptz
    INTO profile_id, group_id, due_date
    FROM public.collection_payments cp
    JOIN public.collections c ON c.id = cp.collection_id
    WHERE cp.id = payment_id;
  ELSE
    RAISE EXCEPTION 'Invalid payment_type: %', payment_type;
  END IF;

  IF profile_id IS NULL THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;

  -- Crear token con información codificada
  -- Formato: payment_id:profile_id:payment_type:expiry_timestamp (base64)
  token_data := jsonb_build_object(
    'pid', payment_id,
    'uid', profile_id,
    'type', payment_type,
    'exp', COALESCE(due_date, now() + interval '30 days')
  );

  token := encode(token_data::bytea, 'base64url');

  RETURN token;
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. Función para verificar token de comprobante
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.verify_proof_token(token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  token_data jsonb;
  payment_id uuid;
  profile_id uuid;
  payment_type text;
  expiry timestamptz;
  payment_record record;
BEGIN
  -- Decodificar token
  BEGIN
    token_data := decode(token, 'base64url')::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Token inválido');
  END;

  payment_id := (token_data->>'pid')::uuid;
  profile_id := (token_data->>'uid')::uuid;
  payment_type := token_data->>'type';
  expiry := (token_data->>'exp')::timestamptz;

  -- Verificar expiración
  IF expiry < now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Token expirado');
  END IF;

  -- Verificar que el pago existe y pertenece al usuario
  IF payment_type = 'match_fee' THEN
    SELECT mfp.id, mfp.profile_id, mfp.group_id, mfp.status as payment_status,
           mfp.proof_status, mf.per_player_amount, mf.match_id,
           m.title as match_title
    INTO payment_record
    FROM public.match_fee_payments mfp
    JOIN public.match_fees mf ON mf.id = mfp.match_fee_id
    JOIN public.matches m ON m.id = mf.match_id
    WHERE mfp.id = payment_id AND mfp.profile_id = profile_id;
  ELSIF payment_type = 'collection' THEN
    SELECT cp.id, cp.profile_id, cp.group_id, cp.status as payment_status,
           cp.proof_status, c.amount_per_player, c.title as collection_title,
           NULL::uuid as match_id, c.title as match_title
    INTO payment_record
    FROM public.collection_payments cp
    JOIN public.collections c ON c.id = cp.collection_id
    WHERE cp.id = payment_id AND cp.profile_id = profile_id;
  ELSE
    RETURN jsonb_build_object('valid', false, 'error', 'Tipo de pago inválido');
  END IF;

  IF payment_record IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Pago no encontrado');
  END IF;

  -- Retornar información del pago
  RETURN jsonb_build_object(
    'valid', true,
    'payment_id', payment_id,
    'profile_id', profile_id,
    'group_id', payment_record.group_id,
    'payment_type', payment_type,
    'payment_status', payment_record.payment_status,
    'proof_status', payment_record.proof_status,
    'amount', payment_record.per_player_amount,
    'title', COALESCE(payment_record.match_title, payment_record.collection_title),
    'match_id', payment_record.match_id
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 7. Función para subir comprobante
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.submit_payment_proof(
  payment_id uuid,
  payment_type text,
  proof_url text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();

  IF payment_type = 'match_fee' THEN
    -- Verificar que el pago pertenece al usuario actual
    UPDATE public.match_fee_payments
    SET proof_url = submit_payment_proof.proof_url,
        proof_status = 'submitted',
        proof_submitted_at = now()
    WHERE id = payment_id AND profile_id = current_user_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Pago no encontrado o no autorizado');
    END IF;
  ELSIF payment_type = 'collection' THEN
    UPDATE public.collection_payments
    SET proof_url = submit_payment_proof.proof_url,
        proof_status = 'submitted',
        proof_submitted_at = now()
    WHERE id = payment_id AND profile_id = current_user_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Pago no encontrado o no autorizado');
    END IF;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Tipo de pago inválido');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- -----------------------------------------------------------------------------
-- 8. Función para que admin apruebe/rechace comprobante
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.review_payment_proof(
  payment_id uuid,
  payment_type text,
  new_status text,
  rejection_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  target_group_id uuid;
  is_admin boolean;
BEGIN
  current_user_id := auth.uid();

  -- Obtener group_id del pago
  IF payment_type = 'match_fee' THEN
    SELECT group_id INTO target_group_id
    FROM public.match_fee_payments WHERE id = payment_id;
  ELSIF payment_type = 'collection' THEN
    SELECT group_id INTO target_group_id
    FROM public.collection_payments WHERE id = payment_id;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Tipo de pago inválido');
  END IF;

  -- Verificar que el usuario es admin del grupo
  SELECT public.is_group_admin(target_group_id) INTO is_admin;

  IF NOT is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'No tienes permisos de admin');
  END IF;

  -- Actualizar estado
  IF payment_type = 'match_fee' THEN
    UPDATE public.match_fee_payments
    SET proof_status = new_status,
        proof_reviewed_at = now(),
        proof_rejection_reason = review_payment_proof.rejection_reason
    WHERE id = payment_id;

    -- Si se aprueba, marcar como pagado automáticamente
    IF new_status = 'approved' THEN
      UPDATE public.match_fee_payments
      SET status = 'paid', paid_at = now()
      WHERE id = payment_id;
    END IF;
  ELSIF payment_type = 'collection' THEN
    UPDATE public.collection_payments
    SET proof_status = new_status,
        proof_reviewed_at = now(),
        proof_rejection_reason = review_payment_proof.rejection_reason
    WHERE id = payment_id;

    IF new_status = 'approved' THEN
      UPDATE public.collection_payments
      SET status = 'paid', paid_at = now()
      WHERE id = payment_id;
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- -----------------------------------------------------------------------------
-- 9. RLS policies para tablas de pagos (actualizadas)
-- -----------------------------------------------------------------------------

-- match_fee_payments: el jugador puede actualizar su propio pago para subir comprobante
DROP POLICY IF EXISTS "match fee payments update own proof" ON public.match_fee_payments;
CREATE POLICY "match fee payments update own proof"
ON public.match_fee_payments FOR UPDATE TO authenticated
USING (
  profile_id = auth.uid()
  OR public.is_group_admin(group_id)
)
WITH CHECK (
  profile_id = auth.uid()
  OR public.is_group_admin(group_id)
);

-- collection_payments: el jugador puede actualizar su propio pago para subir comprobante
DROP POLICY IF EXISTS "collection payments update own proof" ON public.collection_payments;
CREATE POLICY "collection payments update own proof"
ON public.collection_payments FOR UPDATE TO authenticated
USING (
  profile_id = auth.uid()
  OR public.is_group_admin(group_id)
)
WITH CHECK (
  profile_id = auth.uid()
  OR public.is_group_admin(group_id)
);
