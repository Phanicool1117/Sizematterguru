import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { z } from "zod";
import { logAuditEvent } from "@/lib/auditLog";

const DIETARY_OPTIONS = ["vegetarian", "vegan", "keto", "paleo", "gluten_free", "dairy_free", "low_carb"];
const ALLERGY_OPTIONS = ["peanuts", "tree_nuts", "milk", "eggs", "soy", "wheat", "fish", "shellfish"];

const onboardingSchema = z.object({
  age: z.number().int().min(13, "Must be at least 13 years old").max(120, "Invalid age"),
  height_cm: z.number().min(50, "Height must be at least 50 cm").max(300, "Height must be less than 300 cm"),
  current_weight_kg: z.number().min(20, "Weight must be at least 20 kg").max(500, "Weight must be less than 500 kg"),
  goal_weight_kg: z.number().min(20, "Goal weight must be at least 20 kg").max(500, "Goal weight must be less than 500 kg"),
});

export const Onboarding = ({ onComplete }: { onComplete: () => void }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    age: "",
    sex: "prefer_not_to_say",
    height_cm: "",
    current_weight_kg: "",
    goal_weight_kg: "",
    activity_level: "moderately_active",
    goal_type: "maintain",
    dietary_preferences: [] as string[],
    allergies: [] as string[],
  });

  const totalSteps = 4;
  const progress = (step / totalSteps) * 100;

  const calculateGoals = () => {
    const age = parseInt(formData.age);
    const weight = parseFloat(formData.current_weight_kg);
    const height = parseFloat(formData.height_cm);
    const goalWeight = parseFloat(formData.goal_weight_kg);

    // Mifflin-St Jeor Equation for BMR
    let bmr = 10 * weight + 6.25 * height - 5 * age;
    if (formData.sex === "male") bmr += 5;
    else if (formData.sex === "female") bmr -= 161;

    // Activity multipliers
    const activityMultipliers: Record<string, number> = {
      sedentary: 1.2,
      lightly_active: 1.375,
      moderately_active: 1.55,
      very_active: 1.725,
      extra_active: 1.9,
    };

    const tdee = bmr * activityMultipliers[formData.activity_level];

    // Adjust based on goal
    let calories = tdee;
    if (formData.goal_type === "lose_weight") calories = tdee - 500;
    else if (formData.goal_type === "gain_weight") calories = tdee + 300;

    // Calculate macros (40% carbs, 30% protein, 30% fat)
    const protein = (calories * 0.3) / 4;
    const carbs = (calories * 0.4) / 4;
    const fat = (calories * 0.3) / 9;

    return {
      daily_calorie_goal: Math.round(calories),
      daily_protein_goal: Math.round(protein),
      daily_carbs_goal: Math.round(carbs),
      daily_fat_goal: Math.round(fat),
    };
  };

  const handleComplete = async () => {
    try {
      // Validate inputs
      const validationResult = onboardingSchema.safeParse({
        age: parseInt(formData.age),
        height_cm: parseFloat(formData.height_cm),
        current_weight_kg: parseFloat(formData.current_weight_kg),
        goal_weight_kg: parseFloat(formData.goal_weight_kg),
      });

      if (!validationResult.success) {
        toast.error(validationResult.error.errors[0].message);
        return;
      }

      const goals = calculateGoals();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("Please log in to complete onboarding");
        return;
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          age: validationResult.data.age,
          sex: formData.sex,
          height_cm: validationResult.data.height_cm,
          current_weight_kg: validationResult.data.current_weight_kg,
          goal_weight_kg: validationResult.data.goal_weight_kg,
          activity_level: formData.activity_level,
          goal_type: formData.goal_type,
          dietary_preferences: formData.dietary_preferences,
          allergies: formData.allergies,
          onboarding_completed: true,
          ...goals,
        })
        .eq("id", user.id);

      if (error) throw error;

      await logAuditEvent('onboarding_completed', 'profiles', user.id, undefined, validationResult.data);
      toast.success("Profile completed! Your personalized plan is ready 🎉");
      onComplete();
    } catch (error) {
      toast.error("Failed to save profile");
    }
  };

  const nextStep = () => {
    if (step === 1 && (!formData.age || !formData.height_cm || !formData.current_weight_kg)) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (step === 2 && !formData.goal_weight_kg) {
      toast.error("Please set your goal weight");
      return;
    }
    if (step < totalSteps) setStep(step + 1);
    else handleComplete();
  };

  return (
    <div className="min-h-screen bg-gradient-soft flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Let's personalize your journey</CardTitle>
          <CardDescription>Step {step} of {totalSteps}</CardDescription>
          <Progress value={progress} className="mt-2" />
        </CardHeader>
        <CardContent className="space-y-6">
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Basic Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="age">Age *</Label>
                  <Input
                    id="age"
                    type="number"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="sex">Sex</Label>
                  <Select value={formData.sex} onValueChange={(value) => setFormData({ ...formData, sex: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                      <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="height">Height (cm) *</Label>
                  <Input
                    id="height"
                    type="number"
                    value={formData.height_cm}
                    onChange={(e) => setFormData({ ...formData, height_cm: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="weight">Current Weight (kg) *</Label>
                  <Input
                    id="weight"
                    type="number"
                    step="0.1"
                    value={formData.current_weight_kg}
                    onChange={(e) => setFormData({ ...formData, current_weight_kg: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Your Goals</h3>
              <div>
                <Label>What's your primary goal?</Label>
                <RadioGroup value={formData.goal_type} onValueChange={(value) => setFormData({ ...formData, goal_type: value })}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="lose_weight" id="lose" />
                    <Label htmlFor="lose">Lose Weight</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="gain_weight" id="gain" />
                    <Label htmlFor="gain">Gain Weight / Build Muscle</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="maintain" id="maintain" />
                    <Label htmlFor="maintain">Maintain Weight</Label>
                  </div>
                </RadioGroup>
              </div>
              <div>
                <Label htmlFor="goal_weight">Goal Weight (kg) *</Label>
                <Input
                  id="goal_weight"
                  type="number"
                  step="0.1"
                  value={formData.goal_weight_kg}
                  onChange={(e) => setFormData({ ...formData, goal_weight_kg: e.target.value })}
                />
              </div>
              <div>
                <Label>Activity Level</Label>
                <Select value={formData.activity_level} onValueChange={(value) => setFormData({ ...formData, activity_level: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sedentary">Sedentary (little to no exercise)</SelectItem>
                    <SelectItem value="lightly_active">Lightly Active (1-3 days/week)</SelectItem>
                    <SelectItem value="moderately_active">Moderately Active (3-5 days/week)</SelectItem>
                    <SelectItem value="very_active">Very Active (6-7 days/week)</SelectItem>
                    <SelectItem value="extra_active">Extra Active (intense exercise daily)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Dietary Preferences</h3>
              <div className="space-y-2">
                <Label>Select any that apply:</Label>
                {DIETARY_OPTIONS.map((option) => (
                  <div key={option} className="flex items-center space-x-2">
                    <Checkbox
                      id={option}
                      checked={formData.dietary_preferences.includes(option)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFormData({ ...formData, dietary_preferences: [...formData.dietary_preferences, option] });
                        } else {
                          setFormData({ ...formData, dietary_preferences: formData.dietary_preferences.filter((p) => p !== option) });
                        }
                      }}
                    />
                    <Label htmlFor={option} className="capitalize">
                      {option.replace("_", " ")}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Allergies & Restrictions</h3>
              <div className="space-y-2">
                <Label>Select any allergies:</Label>
                {ALLERGY_OPTIONS.map((option) => (
                  <div key={option} className="flex items-center space-x-2">
                    <Checkbox
                      id={`allergy-${option}`}
                      checked={formData.allergies.includes(option)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFormData({ ...formData, allergies: [...formData.allergies, option] });
                        } else {
                          setFormData({ ...formData, allergies: formData.allergies.filter((a) => a !== option) });
                        }
                      }}
                    />
                    <Label htmlFor={`allergy-${option}`} className="capitalize">
                      {option.replace("_", " ")}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-between pt-4">
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                Back
              </Button>
            )}
            <Button onClick={nextStep} className="ml-auto">
              {step === totalSteps ? "Complete Setup" : "Next"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
