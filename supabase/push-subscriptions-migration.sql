-- Push Subscriptions Migration
-- Stores Web Push notification subscriptions for each user

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id, endpoint)
);

-- Enable RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can manage their own subscriptions
CREATE POLICY "Users can manage own subscriptions" ON push_subscriptions
  FOR ALL USING (auth.uid() = profile_id);

-- Admins can view all subscriptions (for sending notifications)
CREATE POLICY "Admins can view all subscriptions" ON push_subscriptions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM group_members 
      WHERE profile_id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_profile_id ON push_subscriptions(profile_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_push_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_push_subscriptions_updated_at
  BEFORE UPDATE ON push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_push_subscriptions_updated_at();
