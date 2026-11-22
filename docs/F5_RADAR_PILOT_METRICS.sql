-- F5 Radar pilot — read-only metrics for ONE group (aggregates only, no names, phones or locations).
-- Run with: supabase db query --linked -f docs/F5_RADAR_PILOT_METRICS.sql   (SELECT only; changes nothing)
-- Set the pilot group id in the first CTE.
--
-- What is NOT measured, on purpose: who viewed a listing ("discovery"). Radar 1.0 does not log views
-- or searches, and the user's location is never stored. Discovery is approximated by unique requesters.
WITH params AS (
  SELECT 'ff77c66a-24d8-48a1-82f4-d1474867345e'::uuid AS group_id   -- «Mi chamusca» (pilot)
),
l AS (SELECT * FROM public.radar_listings WHERE group_id = (SELECT group_id FROM params)),
r AS (SELECT * FROM public.radar_requests WHERE group_id = (SELECT group_id FROM params)),
acc AS (SELECT a.* FROM public.radar_match_access a JOIN l ON l.match_id = a.match_id),
att AS (  -- attendance rows of players who came in through Radar
  SELECT DISTINCT ON (at.match_id, at.profile_id) at.match_id, at.profile_id, at.status, at.checked_in
  FROM public.attendances at JOIN acc ON acc.match_id = at.match_id AND acc.profile_id = at.profile_id
),
m AS (SELECT id, match_date, status FROM public.matches WHERE id IN (SELECT match_id FROM l))
SELECT
  (SELECT count(*) FROM l)                                                     AS listings_published,
  (SELECT count(*) FROM l WHERE status = 'open')                               AS listings_open_now,
  (SELECT count(DISTINCT requester_id) FROM r)                                 AS unique_requesters,      -- discovery proxy
  (SELECT count(*) FROM r)                                                     AS requests_received,
  (SELECT count(*) FROM r WHERE status = 'pending')                            AS requests_pending,
  (SELECT count(*) FROM r WHERE status IN ('approved', 'canceled') AND decided_at IS NOT NULL
                                 AND attendance_id IS NOT NULL)                AS requests_accepted,
  (SELECT count(*) FROM r WHERE status = 'rejected')                           AS requests_rejected,
  (SELECT count(*) FROM r WHERE status = 'withdrawn')                          AS requests_withdrawn,
  (SELECT count(*) FROM r WHERE status = 'expired')                            AS requests_expired,
  (SELECT round(avg(extract(epoch FROM decided_at - created_at) / 3600)::numeric, 1)
     FROM r WHERE decided_at IS NOT NULL)                                      AS avg_hours_to_decision,
  (SELECT count(*) FROM att JOIN m ON m.id = att.match_id
     WHERE att.status = 'checked_in' OR att.checked_in)                       AS external_attended_checked_in,
  (SELECT count(*) FROM att JOIN m ON m.id = att.match_id
     WHERE m.status = 'finished' AND att.status = 'confirmed' AND NOT att.checked_in) AS external_confirmed_finished_no_checkin,
  (SELECT count(*) FROM att WHERE att.status = 'no_show')                      AS external_no_shows,
  (SELECT count(*) FROM r WHERE status = 'canceled' AND NOT late_cancel)       AS cancels_on_time,
  (SELECT count(*) FROM r WHERE status = 'canceled' AND late_cancel)           AS cancels_late_with_fine,
  (SELECT count(*) FROM acc WHERE revoked_at IS NULL)                          AS access_active,
  (SELECT count(*) FROM public.radar_group_bans WHERE group_id = (SELECT group_id FROM params)) AS players_blocked,
  -- New sports connections: distinct outsiders accepted, those who came back, and those who later joined the group themselves.
  (SELECT count(DISTINCT profile_id) FROM acc)                                 AS new_connections_accepted,
  (SELECT count(*) FROM (SELECT profile_id FROM acc GROUP BY profile_id HAVING count(*) >= 2) x) AS returning_radar_players,
  (SELECT count(DISTINCT gm.profile_id) FROM public.group_members gm JOIN acc ON acc.profile_id = gm.profile_id
     WHERE gm.group_id = (SELECT group_id FROM params) AND gm.created_at > acc.granted_at) AS joined_group_after_radar;
