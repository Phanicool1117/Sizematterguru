import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, TrendingDown, TrendingUp } from "lucide-react";
import { format, subDays } from "date-fns";

interface WeightLog {
  id: string;
  weight_kg: number;
  log_date: string;
  notes?: string;
}

interface Profile {
  current_weight_kg: number;
  goal_weight_kg: number;
  daily_calorie_goal: number;
}

export const ProgressDashboard = () => {
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [newWeight, setNewWeight] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [calorieData, setCalorieData] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch weight logs
    const { data: logs } = await supabase
      .from("weight_logs")
      .select("*")
      .eq("user_id", user.id)
      .order("log_date", { ascending: true });

    if (logs) setWeightLogs(logs);

    // Fetch profile
    const { data: profileData } = await supabase
      .from("profiles")
      .select("current_weight_kg, goal_weight_kg, daily_calorie_goal")
      .eq("id", user.id)
      .single();

    if (profileData) setProfile(profileData);

    // Fetch last 7 days of meals for calorie chart
    const sevenDaysAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd');
    const { data: meals } = await supabase
      .from("meals")
      .select("meal_date, calories")
      .eq("user_id", user.id)
      .gte("meal_date", sevenDaysAgo)
      .order("meal_date", { ascending: true });

    if (meals) {
      const grouped = meals.reduce((acc: any, meal) => {
        const date = meal.meal_date;
        if (!acc[date]) acc[date] = 0;
        acc[date] += meal.calories || 0;
        return acc;
      }, {});

      const chartData = Object.entries(grouped).map(([date, calories]) => ({
        date: format(new Date(date), 'MMM dd'),
        calories,
        goal: profileData?.daily_calorie_goal || 0,
      }));

      setCalorieData(chartData);
    }
  };

  const handleAddWeight = async () => {
    if (!newWeight) {
      toast.error("Please enter your weight");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from("weight_logs").insert({
        user_id: user.id,
        weight_kg: parseFloat(newWeight),
        notes: newNotes || null,
      });

      if (error) throw error;

      toast.success("Weight logged successfully!");
      setNewWeight("");
      setNewNotes("");
      setDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error("Failed to log weight");
    }
  };

  const weightChartData = weightLogs.map((log) => ({
    date: format(new Date(log.log_date), 'MMM dd'),
    weight: log.weight_kg,
    goal: profile?.goal_weight_kg || 0,
  }));

  const currentWeight = weightLogs.length > 0 ? weightLogs[weightLogs.length - 1].weight_kg : profile?.current_weight_kg;
  const weightChange = weightLogs.length > 1 
    ? currentWeight! - weightLogs[0].weight_kg 
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Progress Dashboard</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Log Weight
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Log Your Weight</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="weight">Weight (kg)</Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.1"
                  value={newWeight}
                  onChange={(e) => setNewWeight(e.target.value)}
                  placeholder="70.5"
                />
              </div>
              <div>
                <Label htmlFor="notes">Notes (optional)</Label>
                <Input
                  id="notes"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Feeling great today!"
                />
              </div>
              <Button onClick={handleAddWeight} className="w-full">
                Save Weight
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Current Weight</CardDescription>
            <CardTitle className="text-3xl">{currentWeight?.toFixed(1)} kg</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Goal Weight</CardDescription>
            <CardTitle className="text-3xl">{profile?.goal_weight_kg?.toFixed(1)} kg</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Change</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              {weightChange > 0 ? <TrendingUp className="text-green-500" /> : <TrendingDown className="text-blue-500" />}
              {Math.abs(weightChange).toFixed(1)} kg
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Weight Progress</CardTitle>
          <CardDescription>Track your weight over time</CardDescription>
        </CardHeader>
        <CardContent>
          {weightChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={weightChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="weight" stroke="hsl(var(--primary))" strokeWidth={2} />
                <Line type="monotone" dataKey="goal" stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-muted-foreground py-8">No weight data yet. Log your first weight to see progress!</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Calorie Intake (Last 7 Days)</CardTitle>
          <CardDescription>Daily calories vs your goal</CardDescription>
        </CardHeader>
        <CardContent>
          {calorieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={calorieData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="calories" fill="hsl(var(--primary))" />
                <Line type="monotone" dataKey="goal" stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-muted-foreground py-8">No meal data yet. Start logging meals to track your intake!</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
