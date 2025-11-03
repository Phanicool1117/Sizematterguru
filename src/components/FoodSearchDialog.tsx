import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type FoodItem = {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  serving_size: string;
  serving_unit: string;
};

type FoodSearchDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddFood: (food: FoodItem & { servings: number }) => void;
};

export const FoodSearchDialog = ({ open, onOpenChange, onAddFood }: FoodSearchDialogProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<FoodItem[]>([]);
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [servings, setServings] = useState("1");

  const searchFood = async () => {
    if (!searchQuery.trim()) {
      toast.error("Please enter a food name");
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/food-search`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: searchQuery,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to search foods");
      }

      const data = await response.json();
      setSearchResults(data.foods || []);
      
      if (data.foods && data.foods.length > 0) {
        setSelectedFood(data.foods[0]);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to search foods");
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddFood = () => {
    if (!selectedFood) {
      toast.error("Please select a food item");
      return;
    }

    const servingMultiplier = parseFloat(servings) || 1;
    
    onAddFood({
      ...selectedFood,
      calories: Math.round(selectedFood.calories * servingMultiplier),
      protein: Math.round(selectedFood.protein * servingMultiplier),
      carbs: Math.round(selectedFood.carbs * servingMultiplier),
      fat: Math.round(selectedFood.fat * servingMultiplier),
      servings: servingMultiplier,
    });

    // Reset state
    setSearchQuery("");
    setSearchResults([]);
    setSelectedFood(null);
    setServings("1");
    onOpenChange(false);
    
    toast.success("Food added successfully!");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Search Foods</DialogTitle>
          <DialogDescription>
            Search for foods and add them with detailed nutrition information
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Search for a food (e.g., chicken breast, brown rice)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  searchFood();
                }
              }}
            />
            <Button onClick={searchFood} disabled={isSearching}>
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Select a food:</Label>
                <RadioGroup value={selectedFood?.name} onValueChange={(name) => {
                  const food = searchResults.find(f => f.name === name);
                  if (food) setSelectedFood(food);
                }}>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto border rounded-lg p-2">
                    {searchResults.map((food, index) => (
                      <div
                        key={index}
                        className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
                        onClick={() => setSelectedFood(food)}
                      >
                        <RadioGroupItem value={food.name} id={`food-${index}`} />
                        <label htmlFor={`food-${index}`} className="flex-1 cursor-pointer">
                          <div className="font-medium">{food.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {food.calories} cal, {food.serving_size} {food.serving_unit}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Protein: {food.protein}g • Carbs: {food.carbs}g • Fat: {food.fat}g
                          </div>
                        </label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>
              </div>

              {selectedFood && (
                <div className="border rounded-lg p-4 bg-accent/5 space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg mb-2">{selectedFood.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      Per {selectedFood.serving_size} {selectedFood.serving_unit}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="servings" className="text-sm font-medium">
                        Number of servings
                      </Label>
                      <Input
                        id="servings"
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={servings}
                        onChange={(e) => setServings(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-3">Nutrition Facts (Total)</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex justify-between p-2 bg-background rounded">
                        <span className="text-sm">Calories</span>
                        <span className="font-semibold">
                          {Math.round(selectedFood.calories * (parseFloat(servings) || 1))}
                        </span>
                      </div>
                      <div className="flex justify-between p-2 bg-background rounded">
                        <span className="text-sm">Protein</span>
                        <span className="font-semibold">
                          {Math.round(selectedFood.protein * (parseFloat(servings) || 1))}g
                        </span>
                      </div>
                      <div className="flex justify-between p-2 bg-background rounded">
                        <span className="text-sm">Carbs</span>
                        <span className="font-semibold">
                          {Math.round(selectedFood.carbs * (parseFloat(servings) || 1))}g
                        </span>
                      </div>
                      <div className="flex justify-between p-2 bg-background rounded">
                        <span className="text-sm">Fat</span>
                        <span className="font-semibold">
                          {Math.round(selectedFood.fat * (parseFloat(servings) || 1))}g
                        </span>
                      </div>
                    </div>
                  </div>

                  <Button onClick={handleAddFood} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Food
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
