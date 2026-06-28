-- Team Colors Migration
-- Adds a color column to teams table so players can identify their team

-- Add color column with default green
ALTER TABLE teams ADD COLUMN IF NOT EXISTS color VARCHAR(7) DEFAULT '#22c55e';

-- Add comment for clarity
COMMENT ON COLUMN teams.color IS 'Team color in hex format for visual identification';

-- Update existing teams with random colors from a predefined palette
UPDATE teams 
SET color = CASE 
  WHEN team_order = 1 THEN '#ef4444'  -- Red
  WHEN team_order = 2 THEN '#3b82f6'  -- Blue
  WHEN team_order = 3 THEN '#22c55e'  -- Green
  WHEN team_order = 4 THEN '#eab308'  -- Yellow
  WHEN team_order = 5 THEN '#f97316'  -- Orange
  WHEN team_order = 6 THEN '#a855f7'  -- Purple
  WHEN team_order = 7 THEN '#1f2937'  -- Black
  WHEN team_order = 8 THEN '#ffffff'  -- White
  ELSE '#22c55e'
END
WHERE color IS NULL;
