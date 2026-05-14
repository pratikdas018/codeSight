import { requireSupabase } from "../lib/supabase";
import { requireSessionUserId } from "./sessionService";
import type { CodeSnippet, SupportedLanguage } from "../utils/types";

const mapSnippet = (snippet: {
  id: string;
  user_id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  language: SupportedLanguage;
  code: string;
  created_at: string;
  updated_at: string;
  last_opened_at: string | null;
}): CodeSnippet => ({
  id: snippet.id,
  userId: snippet.user_id,
  workspaceId: snippet.workspace_id,
  title: snippet.title,
  description: snippet.description,
  language: snippet.language,
  code: snippet.code,
  createdAt: snippet.created_at,
  updatedAt: snippet.updated_at,
  lastOpenedAt: snippet.last_opened_at,
});

export const listSnippets = async (userId: string) => {
  const sessionUserId = await requireSessionUserId(userId);
  const { data, error } = await requireSupabase()
    .from("snippets")
    .select(
      "id, user_id, workspace_id, title, description, language, code, created_at, updated_at, last_opened_at",
    )
    .eq("user_id", sessionUserId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data.map(mapSnippet);
};

export const getSnippetById = async (snippetId: string, userId: string) => {
  const sessionUserId = await requireSessionUserId(userId);
  const { data, error } = await requireSupabase()
    .from("snippets")
    .select(
      "id, user_id, workspace_id, title, description, language, code, created_at, updated_at, last_opened_at",
    )
    .eq("id", snippetId)
    .eq("user_id", sessionUserId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapSnippet(data);
};

export const createSnippet = async (payload: {
  userId: string;
  title: string;
  language: SupportedLanguage;
  code: string;
  workspaceId?: string;
  description?: string;
}) => {
  const sessionUserId = await requireSessionUserId(payload.userId);
  const { data, error } = await requireSupabase()
    .from("snippets")
    .insert({
      user_id: sessionUserId,
      workspace_id: payload.workspaceId,
      title: payload.title,
      description: payload.description,
      language: payload.language,
      code: payload.code,
    })
    .select(
      "id, user_id, workspace_id, title, description, language, code, created_at, updated_at, last_opened_at",
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapSnippet(data);
};

export const updateSnippet = async (
  snippetId: string,
  payload: {
    userId: string;
    title: string;
    language: SupportedLanguage;
    code: string;
    workspaceId?: string;
    description?: string;
  },
) => {
  const sessionUserId = await requireSessionUserId(payload.userId);
  const { data, error } = await requireSupabase()
    .from("snippets")
    .update({
      workspace_id: payload.workspaceId,
      title: payload.title,
      description: payload.description,
      language: payload.language,
      code: payload.code,
    })
    .eq("id", snippetId)
    .eq("user_id", sessionUserId)
    .select(
      "id, user_id, workspace_id, title, description, language, code, created_at, updated_at, last_opened_at",
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapSnippet(data);
};

export const deleteSnippet = async (snippetId: string, userId: string) => {
  const sessionUserId = await requireSessionUserId(userId);
  const { error } = await requireSupabase()
    .from("snippets")
    .delete()
    .eq("id", snippetId)
    .eq("user_id", sessionUserId);

  if (error) {
    throw new Error(error.message);
  }
};
