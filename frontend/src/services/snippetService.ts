import { supabase } from "../lib/supabase";
import type { CodeSnippet, SupportedLanguage } from "../utils/types";

const mapSnippet = (snippet: {
  id: string;
  user_id: string;
  title: string;
  language: SupportedLanguage;
  code: string;
  created_at: string;
}): CodeSnippet => ({
  id: snippet.id,
  userId: snippet.user_id,
  title: snippet.title,
  language: snippet.language,
  code: snippet.code,
  createdAt: snippet.created_at,
});

export const listSnippets = async () => {
  const { data, error } = await supabase
    .from("snippets")
    .select("id, user_id, title, language, code, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data.map(mapSnippet);
};

export const getSnippetById = async (snippetId: string) => {
  const { data, error } = await supabase
    .from("snippets")
    .select("id, user_id, title, language, code, created_at")
    .eq("id", snippetId)
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
}) => {
  const { data, error } = await supabase
    .from("snippets")
    .insert({
      user_id: payload.userId,
      title: payload.title,
      language: payload.language,
      code: payload.code,
    })
    .select("id, user_id, title, language, code, created_at")
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
  },
) => {
  const { data, error } = await supabase
    .from("snippets")
    .update({
      title: payload.title,
      language: payload.language,
      code: payload.code,
    })
    .eq("id", snippetId)
    .eq("user_id", payload.userId)
    .select("id, user_id, title, language, code, created_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapSnippet(data);
};

export const deleteSnippet = async (snippetId: string, userId: string) => {
  const { error } = await supabase
    .from("snippets")
    .delete()
    .eq("id", snippetId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }
};
