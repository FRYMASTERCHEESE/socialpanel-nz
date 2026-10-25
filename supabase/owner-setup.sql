-- Do NOT run this in any existing user project.
-- Run in your NEW SocialPanel NZ project's SQL Editor AFTER you sign in once.
-- Replace YOUR_OWN_EMAIL@example.com with the exact email of your own account.
-- This selects an existing Auth user, rather than accepting arbitrary front-end role claims.
insert into public.app_admins(user_id)
select id from auth.users where lower(email)=lower('YOUR_OWN_EMAIL@example.com')
on conflict (user_id) do nothing;

-- Check that you got exactly one row. Never run with another customer's email.
select a.user_id,u.email,a.granted_at from public.app_admins a join auth.users u on u.id=a.user_id;
