-- Initialize Supabase schema for Talent Scout game

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Set up Row Level Security (RLS)
ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret-here';

-- Create tables
-- Users table (profiles extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
  email TEXT NOT NULL,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  
  CONSTRAINT username_length CHECK (char_length(username) >= 3 AND char_length(username) <= 30),
  CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Saved games table
CREATE TABLE IF NOT EXISTS public.saved_games (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  is_auto_save BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  game_data JSONB NOT NULL -- Stores the entire game state as JSON
);

-- Game settings/preferences
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  settings JSONB DEFAULT '{}' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  
  CONSTRAINT unique_user_settings UNIQUE (user_id)
);

-- Create a table for storing player templates
CREATE TABLE IF NOT EXISTS public.player_templates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  region_id TEXT NOT NULL,
  position TEXT NOT NULL,
  age_range JSONB NOT NULL, -- e.g. {"min": 16, "max": 23}
  attribute_ranges JSONB NOT NULL, -- e.g. {"technical": {"min": 1, "max": 10}, "physical": {...}, "mental": {...}}
  potential_ranges JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create a table for storing generated players
CREATE TABLE IF NOT EXISTS public.generated_players (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  template_id UUID REFERENCES public.player_templates(id),
  name TEXT NOT NULL,
  region_id TEXT NOT NULL,
  age INTEGER NOT NULL,
  position TEXT NOT NULL,
  attributes JSONB NOT NULL, -- e.g. {"technical": 8, "physical": 7, "mental": 6}
  potential INTEGER NOT NULL,
  scouting_report JSONB NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create a table for storing scout templates
CREATE TABLE IF NOT EXISTS public.scout_templates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nationality TEXT NOT NULL,
  skill_ranges JSONB NOT NULL, -- e.g. {"talent_spotting": {"min": 1, "max": 10}, ...}
  salary_range JSONB NOT NULL, -- e.g. {"min": 1000, "max": 5000}
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create a table for storing generated scouts
CREATE TABLE IF NOT EXISTS public.generated_scouts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  template_id UUID REFERENCES public.scout_templates(id),
  name TEXT NOT NULL,
  nationality TEXT NOT NULL,
  skills JSONB NOT NULL, -- e.g. {"talent_spotting": 8, "player_potential": 7, ...}
  salary INTEGER NOT NULL,
  description TEXT NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create a table for storing match templates
CREATE TABLE IF NOT EXISTS public.match_templates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  region_id TEXT NOT NULL,
  team_level_range JSONB NOT NULL, -- e.g. {"min": 1, "max": 10}
  talent_probability_range JSONB NOT NULL, -- e.g. {"min": 0.1, "max": 0.5}
  action_point_cost_range JSONB NOT NULL, -- e.g. {"min": 1, "max": 3}
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create a table for storing generated matches
CREATE TABLE IF NOT EXISTS public.generated_matches (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  template_id UUID REFERENCES public.match_templates(id),
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  location TEXT NOT NULL,
  region_id TEXT NOT NULL,
  date INTEGER NOT NULL, -- in game week number
  talent_probability FLOAT NOT NULL,
  action_point_cost INTEGER NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create RLS policies for security
-- Profiles can only be read and updated by the owner
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by users who created them." 
  ON public.profiles FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile." 
  ON public.profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile." 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id);

-- Saved games can only be accessed by the owner
ALTER TABLE public.saved_games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Saved games are viewable by users who created them." 
  ON public.saved_games FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own saved games." 
  ON public.saved_games FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own saved games." 
  ON public.saved_games FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved games." 
  ON public.saved_games FOR DELETE 
  USING (auth.uid() = user_id);

-- User settings can only be accessed by the owner
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User settings are viewable by users who created them." 
  ON public.user_settings FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings." 
  ON public.user_settings FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings." 
  ON public.user_settings FOR UPDATE 
  USING (auth.uid() = user_id);

-- Generated data can be accessed by anyone (they are templates)
ALTER TABLE public.player_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Player templates are viewable by all authenticated users." 
  ON public.player_templates FOR SELECT 
  USING (auth.role() = 'authenticated');

ALTER TABLE public.generated_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Generated players are viewable by all authenticated users." 
  ON public.generated_players FOR SELECT 
  USING (auth.role() = 'authenticated');

ALTER TABLE public.scout_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Scout templates are viewable by all authenticated users." 
  ON public.scout_templates FOR SELECT 
  USING (auth.role() = 'authenticated');

ALTER TABLE public.generated_scouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Generated scouts are viewable by all authenticated users." 
  ON public.generated_scouts FOR SELECT 
  USING (auth.role() = 'authenticated');

ALTER TABLE public.match_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Match templates are viewable by all authenticated users." 
  ON public.match_templates FOR SELECT 
  USING (auth.role() = 'authenticated');

ALTER TABLE public.generated_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Generated matches are viewable by all authenticated users." 
  ON public.generated_matches FOR SELECT 
  USING (auth.role() = 'authenticated');

-- Create triggers for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

CREATE TRIGGER update_saved_games_updated_at
BEFORE UPDATE ON public.saved_games
FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

CREATE TRIGGER update_user_settings_updated_at
BEFORE UPDATE ON public.user_settings
FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

CREATE TRIGGER update_player_templates_updated_at
BEFORE UPDATE ON public.player_templates
FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

CREATE TRIGGER update_scout_templates_updated_at
BEFORE UPDATE ON public.scout_templates
FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

CREATE TRIGGER update_match_templates_updated_at
BEFORE UPDATE ON public.match_templates
FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username, display_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'username', NEW.raw_user_meta_data->>'display_name');
  
  INSERT INTO public.user_settings (user_id, settings)
  VALUES (NEW.id, '{"theme": "light", "notifications": true, "sound": true}');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger the function every time a user is created
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();