import type { Json, Database } from "../lib/supabase.types";
import { requireSupabase } from "../lib/supabase";
import { requireSessionUserId } from "./sessionService";

type Tables = Database["public"]["Tables"];
type LessonRow = Tables["lessons"]["Row"];
type CategoryRow = Tables["lesson_categories"]["Row"];
type ProgressRow = Tables["lesson_progress"]["Row"];
type BookmarkRow = Tables["lesson_bookmarks"]["Row"];
type QuizAttemptRow = Tables["quiz_attempts"]["Row"];

export type LessonDifficulty = "beginner" | "intermediate" | "advanced";
export type LessonProgressStatus = "not_started" | "in_progress" | "completed";

export interface LessonSummary extends LessonRow {
  category: Pick<CategoryRow, "id" | "name" | "slug" | "description"> | null;
}

export interface LessonFilters {
  search?: string;
  categorySlug?: string;
  difficulty?: LessonDifficulty;
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export interface LessonProgressInput {
  progressPercentage: number;
  lastPosition: number;
  status?: LessonProgressStatus;
}

export interface QuizAttemptInput {
  score: number;
  totalQuestions: number;
  answers: Json;
}

export interface LearningAnalytics {
  totalStarted: number;
  totalCompleted: number;
  completionRate: number;
  totalQuizAttempts: number;
  averageQuizScore: number | null;
  recentActivity: ProgressRow[];
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const normalizePage = (page = 1) => Math.max(1, Math.floor(page));

const normalizePageSize = (pageSize = DEFAULT_PAGE_SIZE) =>
  Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(pageSize)));

const assertUuid = (value: string, fieldName: string) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error(`${fieldName} must be a valid identifier.`);
  }
};

const assertSlug = (value: string, fieldName: string) => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    throw new Error(`${fieldName} must be a valid lesson slug.`);
  }
};

const assertProgress = (input: LessonProgressInput) => {
  if (!Number.isInteger(input.progressPercentage) || input.progressPercentage < 0 || input.progressPercentage > 100) {
    throw new Error("Progress percentage must be an integer from 0 to 100.");
  }
  if (!Number.isInteger(input.lastPosition) || input.lastPosition < 0) {
    throw new Error("Last position must be a non-negative integer.");
  }
  if (input.status === "completed" && input.progressPercentage !== 100) {
    throw new Error("Completed lessons must have 100 percent progress.");
  }
};

const assertQuizAttempt = (attempt: QuizAttemptInput) => {
  if (!Number.isInteger(attempt.totalQuestions) || attempt.totalQuestions <= 0) {
    throw new Error("Total questions must be a positive integer.");
  }
  if (!Number.isInteger(attempt.score) || attempt.score < 0 || attempt.score > attempt.totalQuestions) {
    throw new Error("Quiz score must be between zero and the total question count.");
  }
  if (!Array.isArray(attempt.answers) && (typeof attempt.answers !== "object" || attempt.answers === null)) {
    throw new Error("Quiz answers must be an array or object.");
  }
};

const mapLesson = (row: LessonRow & { category?: LessonSummary["category"] }): LessonSummary => ({
  ...row,
  category: row.category ?? null,
});

export const getLessons = async (filters: LessonFilters = {}): Promise<PaginatedResult<LessonSummary>> => {
  const page = normalizePage(filters.page);
  const pageSize = normalizePageSize(filters.pageSize);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const search = filters.search?.trim();
  const supabase = requireSupabase();

  let query = supabase
    .from("lessons")
    .select("*, category:lesson_categories!lessons_category_id_fkey(id, name, slug, description)", { count: "exact" })
    .eq("published", true)
    .order("updated_at", { ascending: false })
    .range(from, to);

  if (search) {
    query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
  }
  if (filters.difficulty) {
    query = query.eq("difficulty", filters.difficulty);
  }
  if (filters.categorySlug) {
    assertSlug(filters.categorySlug, "Category slug");
    query = query.eq("category.slug", filters.categorySlug);
  }

  const { data, error, count } = await query;
  if (error) throw new Error("Unable to load lessons.");

  const total = count ?? 0;
  return { data: (data ?? []).map((row) => mapLesson(row)), page, pageSize, total, hasMore: from + (data?.length ?? 0) < total };
};

export const getLessonBySlug = async (slug: string): Promise<LessonSummary | null> => {
  assertSlug(slug, "Lesson slug");
  const { data, error } = await requireSupabase()
    .from("lessons")
    .select("*, category:lesson_categories!lessons_category_id_fkey(id, name, slug, description)")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();

  if (error) throw new Error("Unable to load this lesson.");
  return data ? mapLesson(data) : null;
};

export const getLessonsByCategory = (categorySlug: string, options: Omit<LessonFilters, "categorySlug"> = {}) =>
  getLessons({ ...options, categorySlug });

export const searchLessons = (search: string, options: Omit<LessonFilters, "search"> = {}) =>
  getLessons({ ...options, search });

export const getUserProgress = async (): Promise<ProgressRow[]> => {
  const userId = await requireSessionUserId();
  const { data, error } = await requireSupabase()
    .from("lesson_progress")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error("Unable to load learning progress.");
  return data ?? [];
};

export const getLessonProgress = async (lessonId: string): Promise<ProgressRow | null> => {
  assertUuid(lessonId, "Lesson ID");
  const userId = await requireSessionUserId();
  const { data, error } = await requireSupabase()
    .from("lesson_progress")
    .select("*")
    .eq("user_id", userId)
    .eq("lesson_id", lessonId)
    .maybeSingle();
  if (error) throw new Error("Unable to load lesson progress.");
  return data;
};

export const updateLessonProgress = async (lessonId: string, input: LessonProgressInput): Promise<ProgressRow> => {
  assertUuid(lessonId, "Lesson ID");
  assertProgress(input);
  const userId = await requireSessionUserId();
  const status = input.status ?? (input.progressPercentage >= 100 ? "completed" : "in_progress");
  const now = new Date().toISOString();
  const { data, error } = await requireSupabase()
    .from("lesson_progress")
    .upsert({
      user_id: userId,
      lesson_id: lessonId,
      status,
      progress_percentage: input.progressPercentage,
      last_position: input.lastPosition,
      started_at: now,
      completed_at: status === "completed" ? now : null,
      updated_at: now,
    }, { onConflict: "user_id,lesson_id" })
    .select("*")
    .single();
  if (error) throw new Error("Unable to save learning progress.");
  return data;
};

export const completeLesson = (lessonId: string) =>
  updateLessonProgress(lessonId, { progressPercentage: 100, lastPosition: 0, status: "completed" });

export const getBookmarks = async (): Promise<BookmarkRow[]> => {
  const userId = await requireSessionUserId();
  const { data, error } = await requireSupabase()
    .from("lesson_bookmarks")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Unable to load bookmarks.");
  return data ?? [];
};

export const addBookmark = async (lessonId: string): Promise<BookmarkRow> => {
  assertUuid(lessonId, "Lesson ID");
  const userId = await requireSessionUserId();
  const { data, error } = await requireSupabase()
    .from("lesson_bookmarks")
    .upsert({ user_id: userId, lesson_id: lessonId }, { onConflict: "user_id,lesson_id" })
    .select("*")
    .single();
  if (error) throw new Error("Unable to add bookmark.");
  return data;
};

export const removeBookmark = async (lessonId: string) => {
  assertUuid(lessonId, "Lesson ID");
  const userId = await requireSessionUserId();
  const { error } = await requireSupabase().from("lesson_bookmarks").delete().eq("user_id", userId).eq("lesson_id", lessonId);
  if (error) throw new Error("Unable to remove bookmark.");
};

export const submitQuizAttempt = async (lessonId: string, attempt: QuizAttemptInput): Promise<QuizAttemptRow> => {
  assertUuid(lessonId, "Lesson ID");
  assertQuizAttempt(attempt);
  const userId = await requireSessionUserId();
  const { data, error } = await requireSupabase()
    .from("quiz_attempts")
    .insert({ user_id: userId, lesson_id: lessonId, score: attempt.score, total_questions: attempt.totalQuestions, answers: attempt.answers })
    .select("*")
    .single();
  if (error) throw new Error("Unable to save quiz attempt.");
  return data;
};

export const getQuizHistory = async (lessonId?: string, page = 1, pageSize = DEFAULT_PAGE_SIZE): Promise<PaginatedResult<QuizAttemptRow>> => {
  if (lessonId) assertUuid(lessonId, "Lesson ID");
  const userId = await requireSessionUserId();
  const normalizedPage = normalizePage(page);
  const normalizedPageSize = normalizePageSize(pageSize);
  const from = (normalizedPage - 1) * normalizedPageSize;
  const to = from + normalizedPageSize - 1;
  let query = requireSupabase().from("quiz_attempts").select("*", { count: "exact" }).eq("user_id", userId).order("completed_at", { ascending: false }).range(from, to);
  if (lessonId) query = query.eq("lesson_id", lessonId);
  const { data, error, count } = await query;
  if (error) throw new Error("Unable to load quiz history.");
  const total = count ?? 0;
  return { data: data ?? [], page: normalizedPage, pageSize: normalizedPageSize, total, hasMore: from + (data?.length ?? 0) < total };
};

export const getLearningHistory = async (page = 1, pageSize = DEFAULT_PAGE_SIZE) => getQuizHistory(undefined, page, pageSize);

export const getLearningAnalytics = async (): Promise<LearningAnalytics> => {
  const [progress, quizHistory] = await Promise.all([getUserProgress(), getQuizHistory(undefined, 1, MAX_PAGE_SIZE)]);
  const totalStarted = progress.filter((item) => item.started_at !== null || item.status !== "not_started").length;
  const totalCompleted = progress.filter((item) => item.status === "completed").length;
  const total = Math.max(totalStarted, 1);
  const attempts = quizHistory.data;
  return {
    totalStarted,
    totalCompleted,
    completionRate: Math.round((totalCompleted / total) * 100),
    totalQuizAttempts: quizHistory.total,
    averageQuizScore: attempts.length ? attempts.reduce((sum, item) => sum + (item.score / item.total_questions) * 100, 0) / attempts.length : null,
    recentActivity: progress.slice(0, 10),
  };
};
