ALTER TABLE public.online_members ADD COLUMN IF NOT EXISTS avatar smallint NOT NULL DEFAULT 0;
ALTER TABLE public.online_members ADD CONSTRAINT online_members_avatar_range CHECK (avatar BETWEEN 0 AND 63);

DROP FUNCTION IF EXISTS public.create_online_room(text);
DROP FUNCTION IF EXISTS public.join_online_room(text, text);

CREATE FUNCTION public.create_online_room(p_name text, p_seat integer DEFAULT 0, p_avatar integer DEFAULT 0)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE rid uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Masuk terlebih dahulu'; END IF;
 IF char_length(trim(p_name)) NOT BETWEEN 1 AND 24 THEN RAISE EXCEPTION 'Nama harus 1–24 karakter'; END IF;
 IF p_seat IS NULL OR p_seat NOT BETWEEN 0 AND 4 THEN RAISE EXCEPTION 'Area tidak valid'; END IF;
 IF p_avatar IS NULL OR p_avatar NOT BETWEEN 0 AND 63 THEN RAISE EXCEPTION 'Avatar tidak valid'; END IF;
 INSERT INTO public.online_rooms(host_id) VALUES(auth.uid()) RETURNING id INTO rid;
 INSERT INTO public.online_members(room_id,user_id,seat,name,avatar) VALUES(rid,auth.uid(),p_seat,trim(p_name),p_avatar);
 RETURN rid;
END; $function$;

CREATE FUNCTION public.join_online_room(p_code text, p_name text, p_seat integer DEFAULT NULL, p_avatar integer DEFAULT 0)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r public.online_rooms; next_seat integer;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Masuk terlebih dahulu'; END IF;
 IF char_length(trim(p_name)) NOT BETWEEN 1 AND 24 THEN RAISE EXCEPTION 'Nama harus 1–24 karakter'; END IF;
 IF p_avatar IS NULL OR p_avatar NOT BETWEEN 0 AND 63 THEN RAISE EXCEPTION 'Avatar tidak valid'; END IF;
 SELECT * INTO r FROM public.online_rooms WHERE code=upper(trim(p_code)) FOR UPDATE;
 IF NOT FOUND OR r.status='closed' THEN RAISE EXCEPTION 'Ruang tidak ditemukan'; END IF;
 IF EXISTS(SELECT 1 FROM public.online_members WHERE room_id=r.id AND user_id=auth.uid()) THEN RETURN r.id; END IF;
 IF r.status <> 'lobby' THEN RAISE EXCEPTION 'Permainan sudah dimulai'; END IF;
 IF p_seat BETWEEN 0 AND 4 AND NOT EXISTS(SELECT 1 FROM public.online_members WHERE room_id=r.id AND seat=p_seat) THEN
   next_seat := p_seat;
 ELSE
   SELECT i INTO next_seat FROM generate_series(0,4) i WHERE NOT EXISTS(SELECT 1 FROM public.online_members WHERE room_id=r.id AND seat=i) ORDER BY i LIMIT 1;
 END IF;
 IF next_seat IS NULL THEN RAISE EXCEPTION 'Ruang penuh (maksimal 5 pemain)'; END IF;
 INSERT INTO public.online_members(room_id,user_id,seat,name,avatar) VALUES(r.id,auth.uid(),next_seat,trim(p_name),p_avatar);
 RETURN r.id;
END; $function$;

REVOKE ALL ON FUNCTION public.create_online_room(text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.join_online_room(text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_online_room(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_online_room(text, text, integer, integer) TO authenticated;