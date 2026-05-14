import { requireSupabase } from "../lib/supabase";
import { requireSessionUserId } from "./sessionService";
import type { Workspace } from "../utils/types";

const mapWorkspace = (workspace: {
  created_at: string;
  description: string | null;
  id: string;
  is_default: boolean;
  name: string;
  updated_at: string;
  user_id: string;
}): Workspace => ({
  id: workspace.id,
  userId: workspace.user_id,
  name: workspace.name,
  description: workspace.description,
  isDefault: workspace.is_default,
  createdAt: workspace.created_at,
  updatedAt: workspace.updated_at,
});

export const listWorkspaces = async (userId: string) => {
  const sessionUserId = await requireSessionUserId(userId);
  const { data, error } = await requireSupabase()
    .from("workspaces")
    .select("id, user_id, name, description, is_default, created_at, updated_at")
    .eq("user_id", sessionUserId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data.map(mapWorkspace);
};

export const getDefaultWorkspace = async (userId: string) => {
  const sessionUserId = await requireSessionUserId(userId);
  const { data, error } = await requireSupabase()
    .from("workspaces")
    .select("id, user_id, name, description, is_default, created_at, updated_at")
    .eq("user_id", sessionUserId)
    .eq("is_default", true)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapWorkspace(data);
};
