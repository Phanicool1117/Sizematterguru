import { useState } from "react";
import { ChatInterface } from "@/components/ChatInterface";
import { DietStats } from "@/components/DietStats";
import { MealHistory } from "@/components/MealHistory";
import { FoodSearchDialog } from "@/components/FoodSearchDialog";
import { ProgressDashboard } from "@/components/ProgressDashboard";
import { RecipeBuilder } from "@/components/RecipeBuilder";
import { Settings } from "@/components/Settings";
import { Button } from "@/components/ui/button";
import { Menu, Plus, LogOut, TrendingUp, ChefHat, Settings as SettingsIcon } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logAuditEvent } from "@/lib/auditLog";

const Index = () => {
  const [foodSearchOpen, setFoodSearchOpen] = useState(false);

  const handleAddFood = async (food: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const mealData = {
        user_id: user.id,
        meal_name: food.name,
        meal_type: "snack",
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fats: food.fat,
        notes: `${food.servings} × ${food.serving_size} ${food.serving_unit}`,
      };

      const { error } = await supabase.from("meals").insert(mealData);

      if (error) throw error;

      await logAuditEvent('meal_logged', 'meals', undefined, undefined, mealData);
      window.dispatchEvent(new Event('meals-updated'));
      toast.success('Food logged successfully! 🎉');
    } catch (error) {
      toast.error('Failed to save food data');
    }
  };

  const handleSignOut = async () => {
    await logAuditEvent('user_logout', 'auth', undefined);
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
  };

  return (
    <div className="min-h-screen bg-gradient-soft">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10 shadow-soft">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="text-3xl">🥗</div>
            <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Diet Tracker
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setFoodSearchOpen(true)} size="sm" className="hidden md:flex">
              <Plus className="h-4 w-4 mr-2" />
              Add Food
            </Button>
            <Button onClick={handleSignOut} variant="outline" size="sm" className="hidden md:flex">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Menu</SheetTitle>
                </SheetHeader>
                <div className="mt-6 space-y-4">
                  <Button onClick={() => setFoodSearchOpen(true)} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Food
                  </Button>
                  <Button onClick={handleSignOut} variant="outline" className="w-full">
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </Button>
                  <DietStats />
                  <MealHistory />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <FoodSearchDialog 
        open={foodSearchOpen} 
        onOpenChange={setFoodSearchOpen}
        onAddFood={handleAddFood}
      />

      <div className="container mx-auto p-4">
        <Tabs defaultValue="chat" className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-6">
            <TabsTrigger value="chat">Chat</TabsTrigger>
            <TabsTrigger value="progress">
              <TrendingUp className="h-4 w-4 mr-2 hidden sm:inline" />
              Progress
            </TabsTrigger>
            <TabsTrigger value="recipes">
              <ChefHat className="h-4 w-4 mr-2 hidden sm:inline" />
              Recipes
            </TabsTrigger>
            <TabsTrigger value="meals">Meals</TabsTrigger>
            <TabsTrigger value="settings">
              <SettingsIcon className="h-4 w-4 mr-2 hidden sm:inline" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-12rem)]">
              <div className="lg:col-span-2 bg-card rounded-lg shadow-soft border overflow-hidden flex flex-col">
                <ChatInterface />
              </div>
              <div className="hidden lg:block space-y-6 overflow-y-auto">
                <DietStats />
                <MealHistory />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="progress">
            <ProgressDashboard />
          </TabsContent>

          <TabsContent value="recipes">
            <RecipeBuilder />
          </TabsContent>

          <TabsContent value="meals">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <DietStats />
              <MealHistory />
            </div>
          </TabsContent>

          <TabsContent value="settings">
            <Settings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
