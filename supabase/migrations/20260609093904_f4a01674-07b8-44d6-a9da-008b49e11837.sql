
CREATE TYPE public.app_role AS ENUM ('admin', 'voter');

CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  wallet_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE public.face_descriptors (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  descriptor JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.face_descriptors TO authenticated;
GRANT ALL ON public.face_descriptors TO service_role;
ALTER TABLE public.face_descriptors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own face descriptor" ON public.face_descriptors FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.elections (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  election_type TEXT NOT NULL DEFAULT 'Student',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.elections TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.elections TO authenticated;
GRANT ALL ON public.elections TO service_role;
ALTER TABLE public.elections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Elections are public" ON public.elections FOR SELECT USING (true);
CREATE POLICY "Admins manage elections" ON public.elections FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.candidates (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id UUID NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  vote_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.candidates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidates TO authenticated;
GRANT ALL ON public.candidates TO service_role;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Candidates are public" ON public.candidates FOR SELECT USING (true);
CREATE POLICY "Admins manage candidates" ON public.candidates FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.votes (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id UUID NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nullifier TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (election_id, user_id)
);
GRANT SELECT, INSERT ON public.votes TO authenticated;
GRANT ALL ON public.votes TO service_role;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own votes" ON public.votes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all votes" ON public.votes FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Auto-create profile; first signup becomes admin, rest are voters.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _has_admin BOOLEAN;
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.email, '')
  );
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') INTO _has_admin;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN _has_admin THEN 'voter'::public.app_role ELSE 'admin'::public.app_role END)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.cast_vote(_election_id UUID, _candidate_id UUID, _nullifier TEXT, _tx_hash TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid UUID := auth.uid(); _vote_id UUID;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.elections WHERE id = _election_id AND is_active = true) THEN
    RAISE EXCEPTION 'Election is not active';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.candidates WHERE id = _candidate_id AND election_id = _election_id) THEN
    RAISE EXCEPTION 'Invalid candidate';
  END IF;
  IF EXISTS (SELECT 1 FROM public.votes WHERE election_id = _election_id AND user_id = _uid) THEN
    RAISE EXCEPTION 'You have already voted in this election';
  END IF;
  INSERT INTO public.votes (election_id, candidate_id, user_id, nullifier, tx_hash)
  VALUES (_election_id, _candidate_id, _uid, _nullifier, _tx_hash) RETURNING id INTO _vote_id;
  UPDATE public.candidates SET vote_count = vote_count + 1 WHERE id = _candidate_id;
  RETURN _vote_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cast_vote(uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cast_vote(uuid, uuid, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;

-- Safety: signed-in user can claim admin if there isn't one yet.
CREATE OR REPLACE FUNCTION public.claim_admin_if_unclaimed()
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid UUID := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN RETURN FALSE; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_uid, 'admin') ON CONFLICT DO NOTHING;
  RETURN TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_admin_if_unclaimed() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_admin_if_unclaimed() TO authenticated;
