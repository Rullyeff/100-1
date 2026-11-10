CREATE OR REPLACE FUNCTION public.online_server_ok(p_secret text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT char_length(coalesce(p_secret,'')) >= 12 AND EXISTS(
    SELECT 1 FROM public.online_server_key WHERE hash = encode(sha256(convert_to(p_secret,'UTF8')),'hex'));
$$;
REVOKE ALL ON FUNCTION public.online_server_ok(text) FROM PUBLIC, anon, authenticated;