CREATE TABLE public.online_server_key (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  hash text NOT NULL
);
GRANT ALL ON public.online_server_key TO service_role;
REVOKE ALL ON public.online_server_key FROM anon, authenticated;
ALTER TABLE public.online_server_key ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.online_server_ok(p_secret text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT char_length(coalesce(p_secret,'')) >= 32 AND EXISTS(
    SELECT 1 FROM public.online_server_key WHERE hash = encode(sha256(convert_to(p_secret,'UTF8')),'hex'));
$$;
REVOKE ALL ON FUNCTION public.online_server_ok(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.online_runtime_get(p_secret text, p_room uuid)
RETURNS TABLE(revision integer, checkpoint jsonb) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.online_server_ok(p_secret) THEN RAISE EXCEPTION 'Akses server ditolak'; END IF;
  IF NOT public.is_online_member(p_room) THEN RAISE EXCEPTION 'Bukan anggota ruang'; END IF;
  RETURN QUERY SELECT r.revision, r.checkpoint FROM public.online_runtime r WHERE r.room_id = p_room;
END; $$;

CREATE OR REPLACE FUNCTION public.online_room_begin(p_secret text, p_room uuid, p_checkpoint jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.online_server_ok(p_secret) THEN RAISE EXCEPTION 'Akses server ditolak'; END IF;
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Masuk terlebih dahulu'; END IF;
  PERFORM public.start_online_room(p_room, auth.uid(), p_checkpoint);
END; $$;

CREATE OR REPLACE FUNCTION public.online_runtime_save(p_secret text, p_room uuid, p_revision integer, p_checkpoint jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.online_server_ok(p_secret) THEN RAISE EXCEPTION 'Akses server ditolak'; END IF;
  IF NOT public.is_online_member(p_room) THEN RAISE EXCEPTION 'Bukan anggota ruang'; END IF;
  UPDATE public.online_runtime SET checkpoint = p_checkpoint, revision = p_revision + 1, updated_at = now()
    WHERE room_id = p_room AND revision = p_revision;
  RETURN FOUND;
END; $$;

REVOKE ALL ON FUNCTION public.online_runtime_get(text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.online_room_begin(text, uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.online_runtime_save(text, uuid, integer, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.online_runtime_get(text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.online_room_begin(text, uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.online_runtime_save(text, uuid, integer, jsonb) TO authenticated, service_role;