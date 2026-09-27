
CREATE OR REPLACE FUNCTION public.cast_vote(_election_id UUID, _candidate_id UUID, _nullifier TEXT, _tx_hash TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _vote_id UUID;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
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
  VALUES (_election_id, _candidate_id, _uid, _nullifier, _tx_hash)
  RETURNING id INTO _vote_id;

  UPDATE public.candidates SET vote_count = vote_count + 1 WHERE id = _candidate_id;

  RETURN _vote_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cast_vote(uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cast_vote(uuid, uuid, text, text) TO authenticated;
