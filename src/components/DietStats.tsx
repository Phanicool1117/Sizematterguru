import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Apple, Flame, TrendingUp, Utensils } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { subDays, format } from "date-fns";

export const DietStats = () => {
  const [weeklyStats, setWeeklyStats] = useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    meals: 0,
    avgCalories: 0,
  });

  useEffect(() => {
    fetchWeeklyStats();
    
    const handleUpdate = () => fetchWeeklyStats();
    window.addEventListener('meals-updated', handleUpdate);
    
    return () => {
      window.removeEventListener('meals-updated', handleUpdate);
    };
  }, []);

  const fetchWeeklyStats = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const sevenDaysAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd');

    const { data: meals } = await supabase
      .from("meals")
      .select("*")
      .eq("user_id", user.id)
      .gte("meal_date", sevenDaysAgo);

    if (meals) {
      const totalCalories = meals.reduce((sum, meal) => sum + (meal.calories || 0), 0);
      const totalProtein = meals.reduce((sum, meal) => sum + (Number(meal.protein) || 0), 0);
      const totalCarbs = meals.reduce((sum, meal) => sum + (Number(meal.carbs) || 0), 0);
      const totalFat = meals.reduce((sum, meal) => sum + (Number(meal.fats) || 0), 0);
      const totalMeals = meals.length;

      setWeeklyStats({
        calories: totalCalories,
        protein: Math.round(totalProtein),
        carbs: Math.round(totalCarbs),
        fat: Math.round(totalFat),
        meals: totalMeals,
        avgCalories: totalMeals > 0 ? Math.round(totalCalories / totalMeals) : 0,
      });
    }
  };

  const stats = [
    {
      title: "This Week",
      value: weeklyStats.calories,
      unit: "calories",
      icon: Flame,
      color: "text-orange-500",
    },
    {
      title: "Protein",
      value: weeklyStats.protein,
      unit: "grams",
      icon: Apple,
      color: "text-primary",
    },
    {
      title: "Meals Logged",
      value: weeklyStats.meals,
      unit: "meals",
      icon: Utensils,
      color: "text-accent",
    },
    {
      title: "Avg per Meal",
      value: weeklyStats.avgCalories,
      unit: "calories",
      icon: TrendingUp,
      color: "text-blue-500",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.unit}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Weekly Macros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="space-y-1">
              <p className="text-2xl font-bold text-blue-500">{weeklyStats.protein}g</p>
              <p className="text-xs text-muted-foreground">Protein</p>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold text-yellow-500">{weeklyStats.carbs}g</p>
              <p className="text-xs text-muted-foreground">Carbs</p>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold text-orange-500">{weeklyStats.fat}g</p>
              <p className="text-xs text-muted-foreground">Fat</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
