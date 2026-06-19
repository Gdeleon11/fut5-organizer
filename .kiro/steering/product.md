# Product: fut5-organizer

A mobile-first, self-signup 5-a-side football organizer for private groups ("chamusca").

## Core Purpose

Players sign up, complete their profile, and confirm match attendance from their phones. Each group is independent — data, admins, and settings are scoped per group and never mix.

## Key Roles

- **Player**: Signs up, completes profile, confirms attendance, views fines and teams.
- **Admin**: Activates players, assigns star ratings, creates matches, generates teams, manages fines, uploads court photos.
- **Super Admin**: Full admin capabilities plus role management and group settings.

## Main Features

- Google OAuth and email/password authentication via Supabase
- Profile onboarding (required before access)
- Multi-group support — users can belong to and switch between multiple groups
- Attendance confirmation with late-cancel fine creation
- Balanced team generation (greedy + local swap algorithm, 1–4 star ratings)
- Fines tracking (no-show, late cancel) with paid/forgiven states
- Court fees split evenly among confirmed players
- General collections (ad-hoc group collections)
- Venue catalog with photos
- WhatsApp share text for match invitations and team announcements
- PWA-ready (manifest, service worker, mobile icons)

## Audience

Spanish-speaking players and organizers, primarily in Guatemala (GTQ currency, `es-GT` locale, Spanish UI strings).

## Production URL

https://fut5-organizer.vercel.app
