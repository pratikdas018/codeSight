import { requireSupabase } from "../lib/supabase";
import { requireSessionUserId } from "./sessionService";
import type { UserSettings } from "../utils/types";

const mapSettings = (settings: {
  auto_save: boolean;
  created_at: string;
  editor_font_size: number;
  telemetry_enabled: boolean;
  theme: "system" | "light" | "dark";
  updated_at: string;
  user_id: string;
}): UserSettings => ({
  userId: settings.user_id,
  theme: settings.theme,
  editorFontSize: settings.editor_font_size,
  autoSave: settings.auto_save,
  telemetryEnabled: settings.telemetry_enabled,
  createdAt: settings.created_at,
  updatedAt: settings.updated_at,
});

export const getUserSettings = async (userId: string) => {
  const sessionUserId = await requireSessionUserId(userId);
  const { data, error } = await requireSupabase()
    .from("user_settings")
    .select(
      "user_id, theme, editor_font_size, auto_save, telemetry_enabled, created_at, updated_at",
    )
    .eq("user_id", sessionUserId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapSettings(data);
};

export const updateUserSettings = async (
  userId: string,
  payload: Partial<Pick<UserSettings, "theme" | "editorFontSize" | "autoSave" | "telemetryEnabled">>,
) => {
  const sessionUserId = await requireSessionUserId(userId);
  const { data, error } = await requireSupabase()
    .from("user_settings")
    .update({
      theme: payload.theme,
      editor_font_size: payload.editorFontSize,
      auto_save: payload.autoSave,
      telemetry_enabled: payload.telemetryEnabled,
    })
    .eq("user_id", sessionUserId)
    .select(
      "user_id, theme, editor_font_size, auto_save, telemetry_enabled, created_at, updated_at",
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapSettings(data);
};
