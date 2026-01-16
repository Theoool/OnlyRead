ALTER TABLE public.concepts
  ALTER COLUMN embedding TYPE vector(1024)
  USING NULL::vector(1024);
