import { supabase } from "@/integrations/supabase/client";

export const logAuditEvent = async (
  action: string,
  tableName: string,
  recordId?: string,
  oldData?: any,
  newData?: any
) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action,
      table_name: tableName,
      record_id: recordId,
      old_data: oldData,
      new_data: newData,
      user_agent: navigator.userAgent,
    });
  } catch (error) {
    // Silent fail - don't block operations if logging fails
  }
};
