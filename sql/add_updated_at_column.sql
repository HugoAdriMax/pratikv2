-- Add updated_at column to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add trigger to automatically update timestamp
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS 188629
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
188629 LANGUAGE plpgsql;

-- Create trigger on users table
DROP TRIGGER IF EXISTS set_users_updated_at ON public.users;
CREATE TRIGGER set_users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Refresh schema cache for users table
NOTIFY pgrst, 'reload schema';
