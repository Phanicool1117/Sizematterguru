import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, ChefHat } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Ingredient {
  id: string;
  ingredient_name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface Recipe {
  id: string;
  name: string;
  description: string;
  servings: number;
  prep_time_minutes: number;
  cook_time_minutes: number;
  instructions: string;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  ingredients?: Ingredient[];
}

export const RecipeBuilder = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  
  const [recipeName, setRecipeName] = useState("");
  const [description, setDescription] = useState("");
  const [servings, setServings] = useState("1");
  const [prepTime, setPrepTime] = useState("");
  const [cookTime, setCookTime] = useState("");
  const [instructions, setInstructions] = useState("");
  const [ingredients, setIngredients] = useState<Omit<Ingredient, "id">[]>([]);
  
  const [newIngredient, setNewIngredient] = useState({
    name: "",
    quantity: "",
    unit: "",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
  });

  useEffect(() => {
    fetchRecipes();
  }, []);

  const fetchRecipes = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("recipes")
      .select(`
        *,
        recipe_ingredients (*)
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (data) {
      const formattedRecipes = data.map(recipe => ({
        ...recipe,
        ingredients: recipe.recipe_ingredients || []
      }));
      setRecipes(formattedRecipes);
    }
  };

  const addIngredient = () => {
    if (!newIngredient.name || !newIngredient.quantity) {
      toast.error("Please fill ingredient name and quantity");
      return;
    }

    setIngredients([
      ...ingredients,
      {
        ingredient_name: newIngredient.name,
        quantity: parseFloat(newIngredient.quantity),
        unit: newIngredient.unit || "g",
        calories: parseFloat(newIngredient.calories) || 0,
        protein: parseFloat(newIngredient.protein) || 0,
        carbs: parseFloat(newIngredient.carbs) || 0,
        fat: parseFloat(newIngredient.fat) || 0,
      } as Omit<Ingredient, "id">,
    ]);

    setNewIngredient({
      name: "",
      quantity: "",
      unit: "",
      calories: "",
      protein: "",
      carbs: "",
      fat: "",
    });
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const calculateTotals = () => {
    const totals = ingredients.reduce(
      (acc, ing) => ({
        calories: acc.calories + (ing.calories || 0),
        protein: acc.protein + (ing.protein || 0),
        carbs: acc.carbs + (ing.carbs || 0),
        fat: acc.fat + (ing.fat || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
    return totals;
  };

  const handleSaveRecipe = async () => {
    if (!recipeName || ingredients.length === 0) {
      toast.error("Please add recipe name and at least one ingredient");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const totals = calculateTotals();

      const { data: recipe, error: recipeError } = await supabase
        .from("recipes")
        .insert({
          user_id: user.id,
          name: recipeName,
          description: description || null,
          servings: parseInt(servings) || 1,
          prep_time_minutes: prepTime ? parseInt(prepTime) : null,
          cook_time_minutes: cookTime ? parseInt(cookTime) : null,
          instructions: instructions || null,
          total_calories: totals.calories,
          total_protein: totals.protein,
          total_carbs: totals.carbs,
          total_fat: totals.fat,
        })
        .select()
        .single();

      if (recipeError) throw recipeError;

      const ingredientInserts = ingredients.map((ing) => ({
        recipe_id: recipe.id,
        ...ing,
      }));

      const { error: ingredientError } = await supabase
        .from("recipe_ingredients")
        .insert(ingredientInserts);

      if (ingredientError) throw ingredientError;

      toast.success("Recipe saved successfully! 🎉");
      resetForm();
      setDialogOpen(false);
      fetchRecipes();
    } catch (error) {
      toast.error("Failed to save recipe");
    }
  };

  const resetForm = () => {
    setRecipeName("");
    setDescription("");
    setServings("1");
    setPrepTime("");
    setCookTime("");
    setInstructions("");
    setIngredients([]);
    setEditingRecipe(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <ChefHat className="h-6 w-6" />
          Recipe Builder
        </h2>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Recipe
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Recipe</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="name">Recipe Name *</Label>
                  <Input
                    id="name"
                    value={recipeName}
                    onChange={(e) => setRecipeName(e.target.value)}
                    placeholder="Grilled Chicken Salad"
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="A healthy and delicious meal..."
                  />
                </div>
                <div>
                  <Label htmlFor="servings">Servings</Label>
                  <Input
                    id="servings"
                    type="number"
                    value={servings}
                    onChange={(e) => setServings(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="prep">Prep Time (min)</Label>
                  <Input
                    id="prep"
                    type="number"
                    value={prepTime}
                    onChange={(e) => setPrepTime(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label className="text-lg font-semibold">Ingredients</Label>
                <div className="mt-2 space-y-2">
                  {ingredients.map((ing, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-muted rounded">
                      <span className="flex-1">
                        {ing.ingredient_name} - {ing.quantity} {ing.unit}
                      </span>
                      <Badge variant="secondary">{ing.calories} kcal</Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeIngredient(idx)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Ingredient name"
                    value={newIngredient.name}
                    onChange={(e) => setNewIngredient({ ...newIngredient, name: e.target.value })}
                  />
                  <Input
                    placeholder="Quantity"
                    type="number"
                    value={newIngredient.quantity}
                    onChange={(e) => setNewIngredient({ ...newIngredient, quantity: e.target.value })}
                  />
                  <Input
                    placeholder="Unit (g, oz, cup)"
                    value={newIngredient.unit}
                    onChange={(e) => setNewIngredient({ ...newIngredient, unit: e.target.value })}
                  />
                  <Input
                    placeholder="Calories"
                    type="number"
                    value={newIngredient.calories}
                    onChange={(e) => setNewIngredient({ ...newIngredient, calories: e.target.value })}
                  />
                  <Input
                    placeholder="Protein (g)"
                    type="number"
                    value={newIngredient.protein}
                    onChange={(e) => setNewIngredient({ ...newIngredient, protein: e.target.value })}
                  />
                  <Input
                    placeholder="Carbs (g)"
                    type="number"
                    value={newIngredient.carbs}
                    onChange={(e) => setNewIngredient({ ...newIngredient, carbs: e.target.value })}
                  />
                  <Input
                    placeholder="Fat (g)"
                    type="number"
                    value={newIngredient.fat}
                    onChange={(e) => setNewIngredient({ ...newIngredient, fat: e.target.value })}
                  />
                  <Button onClick={addIngredient} className="col-span-2">
                    Add Ingredient
                  </Button>
                </div>
              </div>

              {ingredients.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Total Nutrition</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div>
                        <p className="text-sm text-muted-foreground">Calories</p>
                        <p className="font-bold">{calculateTotals().calories.toFixed(0)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Protein</p>
                        <p className="font-bold">{calculateTotals().protein.toFixed(1)}g</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Carbs</p>
                        <p className="font-bold">{calculateTotals().carbs.toFixed(1)}g</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Fat</p>
                        <p className="font-bold">{calculateTotals().fat.toFixed(1)}g</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div>
                <Label htmlFor="instructions">Instructions</Label>
                <Textarea
                  id="instructions"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="1. Preheat oven...&#10;2. Mix ingredients..."
                  rows={5}
                />
              </div>

              <Button onClick={handleSaveRecipe} className="w-full">
                Save Recipe
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {recipes.map((recipe) => (
          <Card key={recipe.id}>
            <CardHeader>
              <CardTitle>{recipe.name}</CardTitle>
              <CardDescription>{recipe.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Servings:</span>
                  <span>{recipe.servings}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Calories:</span> {recipe.total_calories?.toFixed(0)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Protein:</span> {recipe.total_protein?.toFixed(1)}g
                  </div>
                  <div>
                    <span className="text-muted-foreground">Carbs:</span> {recipe.total_carbs?.toFixed(1)}g
                  </div>
                  <div>
                    <span className="text-muted-foreground">Fat:</span> {recipe.total_fat?.toFixed(1)}g
                  </div>
                </div>
                {recipe.ingredients && recipe.ingredients.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm font-semibold">Ingredients:</p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      {recipe.ingredients.slice(0, 3).map((ing: Ingredient) => (
                        <li key={ing.id}>
                          • {ing.ingredient_name} ({ing.quantity} {ing.unit})
                        </li>
                      ))}
                      {recipe.ingredients.length > 3 && (
                        <li>+ {recipe.ingredients.length - 3} more...</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {recipes.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <ChefHat className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No recipes yet. Create your first recipe to get started!</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
