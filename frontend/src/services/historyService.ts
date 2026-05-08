import { supabase } from "../lib/supabase";
import type { ExecutionHistoryRecord } from "../utils/types";

const mapHistoryRecord = (entry: {
  id: string;
  user_id: string;
  snippet_id: string;
  output: string | null;
  execution_time: number;
  created_at: string;
  snippet: {
    id: string;
    title: string;
    language: ExecutionHistoryRecord["codeSnippet"]["language"];
    code: string;
  } | null;
}): ExecutionHistoryRecord => ({
  id: entry.id,
  userId: entry.user_id,
  snippetId: entry.snippet_id,
  output: entry.output,
  executionTime: entry.execution_time,
  createdAt: entry.created_at,
  codeSnippet: entry.snippet
    ? {
        id: entry.snippet.id,
        title: entry.snippet.title,
        language: entry.snippet.language,
        code: entry.snippet.code,
      }
    : {
        id: entry.snippet_id,
        title: "Deleted snippet",
        language: "javascript",
        code: "",
      },
});

export const listExecutionHistory = async () => {
  const { data, error } = await supabase
    .from("execution_history")
    .select(
      "id, user_id, snippet_id, output, execution_time, created_at, snippet:snippets!execution_history_snippet_id_fkey(id, title, language, code)",
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data.map(mapHistoryRecord);
};

export const createExecutionHistory = async (payload: {
  userId: string;
  snippetId: string;
  output?: string;
  executionTime: number;
}) => {
  const { data: snippet, error: snippetError } = await supabase
    .from("snippets")
    .select("id, user_id")
    .eq("id", payload.snippetId)
    .eq("user_id", payload.userId)
    .single();

  if (snippetError || !snippet) {
    throw new Error("Code snippet not found for this account.");
  }

  const { data, error } = await supabase
    .from("execution_history")
    .insert({
      user_id: payload.userId,
      snippet_id: payload.snippetId,
      output: payload.output ?? null,
      execution_time: payload.executionTime,
    })
    .select(
      "id, user_id, snippet_id, output, execution_time, created_at, snippet:snippets!execution_history_snippet_id_fkey(id, title, language, code)",
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapHistoryRecord(data);
};
