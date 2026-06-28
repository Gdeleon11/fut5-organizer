-- iPhone uploads often arrive as HEIC. Allow them for venue photos.

update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
where id = 'venue-photos';
