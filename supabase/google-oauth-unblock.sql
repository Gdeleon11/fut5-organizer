-- Emergency unblock for Google OAuth callback 500s.
-- The app creates the profile after login with api.ensureProfile(),
-- so the auth.users trigger is optional and can be disabled safely.

drop trigger if exists on_auth_user_created on auth.users;
