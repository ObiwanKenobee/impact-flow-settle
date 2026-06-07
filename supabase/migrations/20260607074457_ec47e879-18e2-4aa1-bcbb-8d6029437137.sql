
CREATE TABLE public.purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('Operator','Institutional','Sovereign')),
  cycle TEXT NOT NULL CHECK (cycle IN ('monthly','annual')),
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  provider TEXT NOT NULL DEFAULT 'mock',
  provider_ref TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.purchases TO anon;
GRANT SELECT, INSERT ON public.purchases TO authenticated;
GRANT ALL ON public.purchases TO service_role;

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create a pending purchase"
  ON public.purchases FOR INSERT
  WITH CHECK (status = 'pending');

CREATE POLICY "Anyone can read a purchase by id"
  ON public.purchases FOR SELECT
  USING (true);
