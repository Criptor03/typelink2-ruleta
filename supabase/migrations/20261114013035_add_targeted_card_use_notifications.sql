ALTER TABLE public.notifications
  ADD COLUMN source_activity_id uuid
  REFERENCES public.card_activity(id)
  ON DELETE CASCADE;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_source_activity_id_key
  UNIQUE (source_activity_id);

GRANT UPDATE (read_at) ON TABLE public.notifications TO authenticated;

CREATE OR REPLACE FUNCTION app_private.create_card_target_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor_name text;
  v_card_name text;
  v_custom_message text;
BEGIN
  IF NEW.activity_type <> 'play'
     OR NEW.actor_id IS NULL
     OR NEW.target_id IS NULL
     OR NEW.target_id = NEW.actor_id THEN
    RETURN NEW;
  END IF;

  SELECT nullif(pg_catalog.btrim(p.display_name), '')
    INTO v_actor_name
  FROM public.profiles p
  WHERE p.id = NEW.actor_id;

  v_actor_name := coalesce(v_actor_name, 'Un entrenador');
  v_card_name := coalesce(
    nullif(pg_catalog.btrim(NEW.details ->> 'card_name'), ''),
    'una carta'
  );
  v_custom_message := nullif(
    pg_catalog.btrim(NEW.details ->> 'custom_message'),
    ''
  );

  INSERT INTO public.notifications (
    recipient_id,
    actor_id,
    notification_type,
    title,
    body,
    payload,
    source_activity_id
  )
  VALUES (
    NEW.target_id,
    NEW.actor_id,
    'card_used_on_you',
    '¡Te han lanzado una carta!',
    v_actor_name || ' ha utilizado ' || v_card_name || ' sobre ti.',
    pg_catalog.jsonb_build_object(
      'activity_id', NEW.id,
      'card_name', v_card_name,
      'card_slug', NEW.details ->> 'card_slug',
      'rarity', NEW.details ->> 'rarity',
      'category', NEW.details ->> 'category',
      'image_path', NEW.details ->> 'image_path',
      'custom_message', v_custom_message
    ),
    NEW.id
  )
  ON CONFLICT (source_activity_id) DO UPDATE
  SET
    recipient_id = EXCLUDED.recipient_id,
    actor_id = EXCLUDED.actor_id,
    title = EXCLUDED.title,
    body = EXCLUDED.body,
    payload = EXCLUDED.payload;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION app_private.create_card_target_notification()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS card_activity_create_target_notification
  ON public.card_activity;

CREATE TRIGGER card_activity_create_target_notification
AFTER INSERT OR UPDATE OF details
ON public.card_activity
FOR EACH ROW
EXECUTE FUNCTION app_private.create_card_target_notification();
