-- Add wallet address column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wallet_address text;

-- Update the trigger to handle wallet_address from user metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, club_name, wallet_address)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'Manager_' || left(new.id::text, 6)),
    coalesce(new.raw_user_meta_data->>'club_name', 'FC ' || left(new.id::text, 6)),
    new.raw_user_meta_data->>'wallet_address'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
