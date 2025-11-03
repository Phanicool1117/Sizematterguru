-- Extend profiles table with onboarding/goal data
ALTER TABLE public.profiles
ADD COLUMN age INTEGER,
ADD COLUMN sex TEXT CHECK (sex IN ('male', 'female', 'other', 'prefer_not_to_say')),
ADD COLUMN height_cm NUMERIC,
ADD COLUMN current_weight_kg NUMERIC,
ADD COLUMN goal_weight_kg NUMERIC,
ADD COLUMN activity_level TEXT CHECK (activity_level IN ('sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extra_active')),
ADD COLUMN goal_type TEXT CHECK (goal_type IN ('lose_weight', 'gain_weight', 'maintain', 'build_muscle')),
ADD COLUMN dietary_preferences TEXT[], -- array for multiple: vegan, vegetarian, keto, paleo, etc
ADD COLUMN allergies TEXT[],
ADD COLUMN daily_calorie_goal INTEGER,
ADD COLUMN daily_protein_goal NUMERIC,
ADD COLUMN daily_carbs_goal NUMERIC,
ADD COLUMN daily_fat_goal NUMERIC,
ADD COLUMN onboarding_completed BOOLEAN DEFAULT FALSE;

-- Create weight logs table for progress tracking
CREATE TABLE public.weight_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weight_kg NUMERIC NOT NULL,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.weight_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own weight logs"
ON public.weight_logs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own weight logs"
ON public.weight_logs FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own weight logs"
ON public.weight_logs FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own weight logs"
ON public.weight_logs FOR DELETE
USING (auth.uid() = user_id);

-- Create recipes table
CREATE TABLE public.recipes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  servings INTEGER NOT NULL DEFAULT 1,
  prep_time_minutes INTEGER,
  cook_time_minutes INTEGER,
  instructions TEXT,
  total_calories NUMERIC,
  total_protein NUMERIC,
  total_carbs NUMERIC,
  total_fat NUMERIC,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recipes"
ON public.recipes FOR SELECT
USING (auth.uid() = user_id OR is_public = true);

CREATE POLICY "Users can insert own recipes"
ON public.recipes FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recipes"
ON public.recipes FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own recipes"
ON public.recipes FOR DELETE
USING (auth.uid() = user_id);

-- Create recipe ingredients table
CREATE TABLE public.recipe_ingredients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  ingredient_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  calories NUMERIC,
  protein NUMERIC,
  carbs NUMERIC,
  fat NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ingredients of accessible recipes"
ON public.recipe_ingredients FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.recipes
    WHERE recipes.id = recipe_ingredients.recipe_id
    AND (recipes.user_id = auth.uid() OR recipes.is_public = true)
  )
);

CREATE POLICY "Users can insert ingredients for own recipes"
ON public.recipe_ingredients FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.recipes
    WHERE recipes.id = recipe_ingredients.recipe_id
    AND recipes.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update ingredients for own recipes"
ON public.recipe_ingredients FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.recipes
    WHERE recipes.id = recipe_ingredients.recipe_id
    AND recipes.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete ingredients for own recipes"
ON public.recipe_ingredients FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.recipes
    WHERE recipes.id = recipe_ingredients.recipe_id
    AND recipes.user_id = auth.uid()
  )
);

-- Add trigger for recipe updated_at
CREATE TRIGGER update_recipes_updated_at
BEFORE UPDATE ON public.recipes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for performance
CREATE INDEX idx_weight_logs_user_date ON public.weight_logs(user_id, log_date DESC);
CREATE INDEX idx_recipes_user ON public.recipes(user_id);
CREATE INDEX idx_recipe_ingredients_recipe ON public.recipe_ingredients(recipe_id);