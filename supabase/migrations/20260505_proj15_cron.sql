-- PROJ-15: Enable pg_cron + pg_net and schedule daily notification job
-- Runs at 07:00 UTC (= 08:00 CET / ~09:00 CEST Europe/Berlin).
-- pg_cron 1.6 timezone column is NOT available in this Supabase version.
--
-- ONE-TIME SETUP required (run once in SQL editor):
--   SELECT vault.create_secret('eyJ...your-service-role-key...', 'SERVICE_ROLE_KEY');
-- Get the key from: Supabase Dashboard → Project Settings → API → service_role key

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'proj15-booking-change-notifier',
  '0 7 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://spadppptimolstufuzca.supabase.co/functions/v1/send-booking-change-notifications',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'SERVICE_ROLE_KEY'
        LIMIT 1
      )
    ),
    body    := '{}'::jsonb
  );
  $$
);
