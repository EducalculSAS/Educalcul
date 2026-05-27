CREATE TABLE IF NOT EXISTS public.programme_pdfs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  level text NOT NULL UNIQUE,
  level_label text,
  file_url text NOT NULL,
  file_name text,
  custom_content text DEFAULT '',
  uploaded_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.programme_pdfs ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "Public can read programme_pdfs"
  ON public.programme_pdfs FOR SELECT USING (true);

-- Admin write
CREATE POLICY "Admin can manage programme_pdfs"
  ON public.programme_pdfs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_id = auth.uid() AND role = 'admin'
    )
  );
