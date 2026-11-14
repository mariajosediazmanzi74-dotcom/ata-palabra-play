CREATE TABLE public.game_data (
  user_id uuid PRIMARY KEY,
  version integer NOT NULL DEFAULT 1,
  names jsonb NOT NULL DEFAULT '{}'::jsonb,
  conversations jsonb NOT NULL DEFAULT '[]'::jsonb,
  rev bigint NOT NULL DEFAULT 1,
  client_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_data TO authenticated;
GRANT ALL ON public.game_data TO service_role;
ALTER TABLE public.game_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own game data: select" ON public.game_data FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own game data: insert" ON public.game_data FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own game data: update" ON public.game_data FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own game data: delete" ON public.game_data FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.audio_files (
  user_id uuid NOT NULL,
  id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('recording', 'line')),
  name text NOT NULL DEFAULT 'Audio',
  mime text NOT NULL DEFAULT 'audio/webm',
  size_bytes bigint NOT NULL DEFAULT 0,
  duration_ms integer NOT NULL DEFAULT 0,
  line_id text,
  line_text text,
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);
CREATE INDEX audio_files_user_kind_idx ON public.audio_files (user_id, kind, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audio_files TO authenticated;
GRANT ALL ON public.audio_files TO service_role;
ALTER TABLE public.audio_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own audio: select" ON public.audio_files FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own audio: insert" ON public.audio_files FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own audio: update" ON public.audio_files FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own audio: delete" ON public.audio_files FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER game_data_touch BEFORE UPDATE ON public.game_data
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.game_data REPLICA IDENTITY FULL;
ALTER TABLE public.audio_files REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_data;
ALTER PUBLICATION supabase_realtime ADD TABLE public.audio_files;