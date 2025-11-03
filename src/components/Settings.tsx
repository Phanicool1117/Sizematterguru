import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Download, Trash2, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logAuditEvent } from "@/lib/auditLog";

export const Settings = () => {
  const [exportLoading, setExportLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleExportData = async () => {
    setExportLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch all user data
      const [profileRes, mealsRes, recipesRes, weightLogsRes, chatRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('meals').select('*').eq('user_id', user.id),
        supabase.from('recipes').select('*, recipe_ingredients(*)').eq('user_id', user.id),
        supabase.from('weight_logs').select('*').eq('user_id', user.id),
        supabase.from('chat_messages').select('*').eq('user_id', user.id),
      ]);

      const exportData = {
        exported_at: new Date().toISOString(),
        user_id: user.id,
        email: user.email,
        profile: profileRes.data,
        meals: mealsRes.data,
        recipes: recipesRes.data,
        weight_logs: weightLogsRes.data,
        chat_messages: chatRes.data,
      };

      // Create and download JSON file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `diet-tracker-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      await logAuditEvent('data_export', 'all_tables', user.id);
      toast.success("Your data has been exported successfully!");
    } catch (error) {
      toast.error("Failed to export data");
    } finally {
      setExportLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Log the deletion attempt
      await logAuditEvent('account_deletion_requested', 'profiles', user.id);

      // First get recipe IDs to delete ingredients
      const { data: recipes } = await supabase
        .from('recipes')
        .select('id')
        .eq('user_id', user.id);
      
      const recipeIds = recipes?.map(r => r.id) || [];

      // Delete all user data
      await Promise.all([
        supabase.from('chat_messages').delete().eq('user_id', user.id),
        supabase.from('weight_logs').delete().eq('user_id', user.id),
        recipeIds.length > 0 
          ? supabase.from('recipe_ingredients').delete().in('recipe_id', recipeIds)
          : Promise.resolve(),
        supabase.from('recipes').delete().eq('user_id', user.id),
        supabase.from('meals').delete().eq('user_id', user.id),
        supabase.from('audit_logs').delete().eq('user_id', user.id),
        supabase.from('profiles').delete().eq('id', user.id),
      ]);

      // Sign out the user
      await supabase.auth.signOut();
      toast.success("Your account has been deleted");
    } catch (error) {
      toast.error("Failed to delete account");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2">
        <Shield className="h-6 w-6 text-primary" />
        <h2 className="text-3xl font-bold">Security & Privacy</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Data Export</CardTitle>
          <CardDescription>
            Download all your personal data in JSON format. This includes your profile, meals, recipes, weight logs, and chat history.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={handleExportData} 
            disabled={exportLoading}
            className="w-full sm:w-auto"
          >
            <Download className="h-4 w-4 mr-2" />
            {exportLoading ? "Exporting..." : "Export My Data"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Delete Account</CardTitle>
          <CardDescription>
            Permanently delete your account and all associated data. This action cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full sm:w-auto">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete My Account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete your account and remove all your data from our servers including:
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Your profile and personal information</li>
                    <li>All meal logs and nutrition data</li>
                    <li>All recipes you've created</li>
                    <li>Weight tracking history</li>
                    <li>Chat history with the AI assistant</li>
                  </ul>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  disabled={deleteLoading}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleteLoading ? "Deleting..." : "Yes, delete my account"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security Information</CardTitle>
          <CardDescription>
            Learn about how we protect your data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-start gap-2">
            <div className="text-primary mt-0.5">🔒</div>
            <div>
              <strong>Password Security:</strong> Your password must be at least 8 characters and include uppercase, lowercase, numbers, and special characters.
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="text-primary mt-0.5">⏱️</div>
            <div>
              <strong>Auto Logout:</strong> You'll be automatically logged out after 30 minutes of inactivity for security.
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="text-primary mt-0.5">📊</div>
            <div>
              <strong>Audit Logging:</strong> We track important actions on your account for security and debugging purposes.
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="text-primary mt-0.5">🔐</div>
            <div>
              <strong>Data Privacy:</strong> Your data is encrypted and only accessible by you. We use Row-Level Security to ensure data isolation.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
