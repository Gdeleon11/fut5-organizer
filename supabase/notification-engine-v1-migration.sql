-- Notification Engine V1 Migration
-- Creates notification_deliveries table for persistent deduplication and audit logging

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'push',
  dedupe_key TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  attempt_count INT NOT NULL DEFAULT 1,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE notification_deliveries ENABLE ROW LEVEL SECURITY;

-- Users can view their own notification log
CREATE POLICY "Users can view own notification deliveries" ON notification_deliveries
  FOR SELECT USING (auth.uid() = profile_id);

-- Admins can view notification logs for their groups
CREATE POLICY "Admins can view group notification deliveries" ON notification_deliveries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM group_members 
      WHERE group_members.group_id = notification_deliveries.group_id 
        AND group_members.profile_id = auth.uid() 
        AND group_members.role IN ('admin', 'super_admin')
    )
  );

-- Indexes for high-performance deduplication and reporting
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_dedupe_key ON notification_deliveries(dedupe_key);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_match_profile ON notification_deliveries(match_id, profile_id);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_created_at ON notification_deliveries(created_at);
