import { requireSupabase } from "../lib/supabase";
import { requireSessionUserId } from "./sessionService";
import type { ExecutionHistoryRecord } from "../utils/types";

const mapHistoryRecord = (entry: {
  id: string;
  user_id: string;
  workspace_id: string | null;
  snippet_id: string | null;
  snippet_title: string;
  snippet_language: ExecutionHistoryRecord["codeSnippet"]["language"];
  snippet_code: string;
  output: string | null;
  execution_time: number;
  created_at: string;
  runtime_status: ExecutionHistoryRecord["runtimeStatus"];
  snippet: {
    id: string;
    title: string;
    language: ExecutionHistoryRecord["codeSnippet"]["language"];
    code: string;
  } | null;
}): ExecutionHistoryRecord => ({
  id: entry.id,
  userId: entry.user_id,
  workspaceId: entry.workspace_id,
  snippetId: entry.snippet_id ?? entry.id,
  output: entry.output,
  executionTime: entry.execution_time,
  createdAt: entry.created_at,
  runtimeStatus: entry.runtime_status,
  codeSnippet: entry.snippet
    ? {
        id: entry.snippet.id,
        title: entry.snippet.title,
        language: entry.snippet.language,
        code: entry.snippet.code,
      }
    : {
        id: entry.snippet_id ?? entry.id,
        title: entry.snippet_title,
        language: entry.snippet_language,
        code: entry.snippet_code,
      },
});

export const listExecutionHistory = async (userId: string) => {
  const sessionUserId = await requireSessionUserId(userId);
  const { data, error } = await requireSupabase()
    .from("execution_history")
    .select(
      "id, user_id, workspace_id, snippet_id, snippet_title, snippet_language, snippet_code, output, execution_time, created_at, runtime_status, snippet:snippets!execution_history_snippet_id_fkey(id, title, language, code)",
    )
    .eq("user_id", sessionUserId)
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
  const sessionUserId = await requireSessionUserId(payload.userId);
  const { data: snippet, error: snippetError } = await requireSupabase()
    .from("snippets")
    .select("id, user_id")
    .eq("id", payload.snippetId)
    .eq("user_id", sessionUserId)
    .single();

  if (snippetError || !snippet) {
    throw new Error("Code snippet not found for this account.");
  }

  const { data, error } = await requireSupabase()
    .from("execution_history")
    .insert({
      user_id: sessionUserId,
      snippet_id: payload.snippetId,
      output: payload.output ?? null,
      execution_time: payload.executionTime,
    })
    .select(
      "id, user_id, workspace_id, snippet_id, snippet_title, snippet_language, snippet_code, output, execution_time, created_at, runtime_status, snippet:snippets!execution_history_snippet_id_fkey(id, title, language, code)",
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapHistoryRecord(data);
};
