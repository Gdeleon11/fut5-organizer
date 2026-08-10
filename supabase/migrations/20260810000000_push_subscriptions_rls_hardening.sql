-- Push Subscriptions RLS Hardening
-- Removes global admin read policy on push_subscriptions.
-- Protects VAPID keys, endpoints, and auth secrets from client-side exposure.
-- Server-side Notification Engine uses service_role key to access subscriptions safely.

DROP POLICY IF EXISTS "Admins can view all subscriptions" ON push_subscriptions;
DROP POLICY IF EXISTS "Users can manage own subscriptions" ON push_subscriptions;

-- Strict owner-only RLS policy for push subscriptions
CREATE POLICY "Users can manage own subscriptions" ON push_subscriptions
  FOR ALL
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id);
