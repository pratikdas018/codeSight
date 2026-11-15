import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Bookmark, BookOpen, CheckCircle2, Clock3, LockKeyhole, Search, Sparkles } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { lessons as localLessons, type Lesson } from "../../learning/lessons";
import {
  addBookmark,
  completeLesson,
  getLessonCategories,
  getLessons,
  getLearningAnalytics,
  getBookmarks,
  getUserProgress,
  removeBookmark,
  updateLessonProgress,
  type LessonDifficulty,
  type LessonProgressStatus,
  type LessonSummary,
} from "../../services/learningService";

type LocalProgress = Record<string, { percentage: number; position: number; status: LessonProgressStatus }>;
type DisplayLesson = {
  id: string;
  slug: string;
  title: string;
  description: string;
  difficulty: LessonDifficulty;
  estimatedDuration: number;
  categoryName: string;
  categorySlug: string;
  remoteId?: string;
  local?: Lesson;
  content?: Record<string, unknown>;
};

const LOCAL_PROGRESS_KEY = "algoloom.learning.progress.v1";
const LOCAL_BOOKMARKS_KEY = "algoloom.learning.bookmarks.v1";

const readLocal = <T,>(key: string, fallback: T): T => {
  try { return JSON.parse(window.localStorage.getItem(key) ?? "") as T; } catch { return fallback; }
};
const writeLocal = (key: string, value: unknown) => window.localStorage.setItem(key, JSON.stringify(value));
const asContentObject = (value: unknown): Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
const asString = (value: unknown, fallback = "") => typeof value === "string" ? value : fallback;
const asStringArray = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const localDisplayLessons: DisplayLesson[] = localLessons.map((lesson) => ({
  id: lesson.id,
  slug: lesson.id,
  title: lesson.title,
  description: lesson.summary,
  difficulty: lesson.level.toLowerCase() as LessonDifficulty,
  estimatedDuration: 8,
  categoryName: lesson.category,
  categorySlug: lesson.category.toLowerCase().replace(/\s+/g, "-"),
  local: lesson,
}));

const remoteDisplayLesson = (lesson: LessonSummary): DisplayLesson => ({
  id: lesson.id,
  slug: lesson.slug,
  title: lesson.title,
  description: lesson.description,
  difficulty: lesson.difficulty as LessonDifficulty,
  estimatedDuration: lesson.estimated_duration,
  categoryName: lesson.category?.name ?? "Uncategorized",
  categorySlug: lesson.category?.slug ?? "uncategorized",
  remoteId: lesson.id,
  content: asContentObject(lesson.content),
});

export const LearnPage = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [catalog, setCatalog] = useState<DisplayLesson[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [progress, setProgress] = useState<LocalProgress>({});
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [analytics, setAnalytics] = useState({ totalStarted: 0, totalCompleted: 0, completionRate: 0, totalQuizAttempts: 0, averageQuizScore: null as number | null });
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState<LessonDifficulty | "all">("all");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingPreview, setUsingPreview] = useState(false);
  const selectedSlug = searchParams.get("lesson");
  const selectedLesson = catalog.find((lesson) => lesson.slug === selectedSlug) ?? null;

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    const load = async () => {
      try {
        const [lessonResult, categoryResult] = await Promise.all([
          getLessons({ search, difficulty: difficulty === "all" ? undefined : difficulty, categorySlug: category === "all" ? undefined : category, page, pageSize: 24 }),
          getLessonCategories(),
        ]);
        if (cancelled) return;
        const nextLessons = lessonResult.data.map(remoteDisplayLesson);
        setUsingPreview(nextLessons.length === 0 && page === 1 && !search && difficulty === "all" && category === "all");
        setCatalog((current) => page === 1 ? nextLessons : [...current, ...nextLessons]);
        setHasMore(lessonResult.hasMore);
        setCategories(categoryResult.map((item) => ({ id: item.id, name: item.name, slug: item.slug })));
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load lessons.");
          if (page === 1) { setCatalog(localDisplayLessons); setUsingPreview(true); }
        }
      } finally { if (!cancelled) setIsLoading(false); }
    };
    void load();
    return () => { cancelled = true; };
  }, [search, difficulty, category, page]);

  useEffect(() => {
    setProgress(readLocal<LocalProgress>(LOCAL_PROGRESS_KEY, {}));
    setBookmarks(readLocal<string[]>(LOCAL_BOOKMARKS_KEY, []));
    if (!user) return;
    let cancelled = false;
    const loadPrivateState = async () => {
      const results = await Promise.allSettled([getUserProgress(), getBookmarks(), getLearningAnalytics()]);
      if (cancelled) return;
      const [progressResult, bookmarkResult, analyticsResult] = results;
      if (progressResult.status === "fulfilled") {
        const next: LocalProgress = {};
        progressResult.value.forEach((item) => { next[item.lesson_id] = { percentage: item.progress_percentage, position: item.last_position, status: item.status as LessonProgressStatus }; });
        setProgress(next);
      }
      if (bookmarkResult.status === "fulfilled") setBookmarks(bookmarkResult.value.map((item) => item.lesson_id));
      if (analyticsResult.status === "fulfilled") setAnalytics(analyticsResult.value);
    };
    void loadPrivateState();
    return () => { cancelled = true; };
  }, [user]);

  const filteredCatalog = useMemo(() => {
    if (!usingPreview) return catalog;
    return catalog.filter((lesson) => (!search || `${lesson.title} ${lesson.description}`.toLowerCase().includes(search.toLowerCase())) && (difficulty === "all" || lesson.difficulty === difficulty) && (category === "all" || lesson.categorySlug === category));
  }, [catalog, usingPreview, search, difficulty, category]);
  const continueLesson = useMemo(() => catalog.find((lesson) => progress[lesson.remoteId ?? lesson.id]?.status === "in_progress") ?? null, [catalog, progress]);

  const updateLocalState = (lesson: DisplayLesson, next: LocalProgress[string]) => {
    setProgress((current) => { const updated = { ...current, [lesson.remoteId ?? lesson.id]: next }; writeLocal(LOCAL_PROGRESS_KEY, updated); return updated; });
  };
  const toggleBookmark = async (lesson: DisplayLesson) => {
    const key = lesson.remoteId ?? lesson.id;
    const isBookmarked = bookmarks.includes(key);
    if (lesson.remoteId && user) {
      try { if (isBookmarked) await removeBookmark(lesson.remoteId); else await addBookmark(lesson.remoteId); }
      catch (bookmarkError) { setError(bookmarkError instanceof Error ? bookmarkError.message : "Unable to update bookmark."); return; }
    }
    setBookmarks((current) => { const next = isBookmarked ? current.filter((item) => item !== key) : [...current, key]; writeLocal(LOCAL_BOOKMARKS_KEY, next); return next; });
  };
  const markComplete = async (lesson: DisplayLesson) => {
    if (lesson.remoteId && user) {
      try { await completeLesson(lesson.remoteId); }
      catch (completeError) { setError(completeError instanceof Error ? completeError.message : "Unable to save completion."); return; }
    }
    updateLocalState(lesson, { percentage: 100, position: 0, status: "completed" });
  };

  if (selectedLesson) return <LessonDetail lesson={selectedLesson} progress={progress[selectedLesson.remoteId ?? selectedLesson.id]} isBookmarked={bookmarks.includes(selectedLesson.remoteId ?? selectedLesson.id)} canSync={Boolean(user)} onBack={() => setSearchParams({})} onBookmark={() => void toggleBookmark(selectedLesson)} onComplete={() => void markComplete(selectedLesson)} onProgress={(next) => updateLocalState(selectedLesson, next)} />;
  const completed = analytics.totalCompleted || Object.values(progress).filter((item) => item.status === "completed").length;
  const started = analytics.totalStarted || Object.values(progress).filter((item) => item.status !== "not_started").length;

  return <div className="space-y-8">
    <section className="rounded-3xl border border-[rgba(39,211,194,0.24)] bg-[linear-gradient(135deg,rgba(39,211,194,0.12),rgba(20,26,34,0.9)_50%)] p-6 sm:p-8"><div className="flex flex-wrap items-start justify-between gap-6"><div className="max-w-2xl"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--cs-primary-bright)]"><Sparkles className="h-4 w-4" /> Learn & understand</div><h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">Build understanding one concept at a time.</h1><p className="mt-4 leading-7 text-[var(--cs-text-muted)]">A focused lesson library for programming fundamentals, algorithms, systems, and developer practice.</p></div>{continueLesson ? <button type="button" onClick={() => setSearchParams({ lesson: continueLesson.slug })} className="inline-flex items-center gap-2 rounded-xl bg-[var(--cs-primary)] px-4 py-3 text-sm font-semibold text-[#061114]">Resume learning <ArrowRight className="h-4 w-4" /></button> : null}</div>{usingPreview ? <div className="mt-6 rounded-xl border border-amber-300/20 bg-amber-300/5 px-4 py-3 text-xs text-amber-100">The database has no published lessons yet. Showing the reviewed starter curriculum until content is published.</div> : null}</section>
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{[["Started", started], ["Completed", completed], ["Completion", `${analytics.completionRate}%`], ["Bookmarks", bookmarks.length], ["Quiz attempts", analytics.totalQuizAttempts]].map(([label, value]) => <div key={label} className="rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-4"><div className="text-xs uppercase tracking-[0.15em] text-[var(--cs-text-subtle)]">{label}</div><div className="mt-2 text-2xl font-semibold text-[var(--cs-text)]">{value}</div></div>)}</section>
    <section className="space-y-4"><div className="flex flex-wrap items-end justify-between gap-3"><div><div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--cs-text-subtle)]">Lesson library</div><h2 className="mt-2 text-2xl font-semibold">Find your next useful idea.</h2></div>{analytics.averageQuizScore !== null ? <div className="text-sm text-[var(--cs-text-muted)]">Average quiz score: {Math.round(analytics.averageQuizScore)}%</div> : null}</div><div className="grid gap-3 lg:grid-cols-[1fr,10rem,12rem]"><label className="relative block"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[var(--cs-text-subtle)]" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search lessons" className="w-full rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] py-2.5 pl-9 pr-3 text-sm text-[var(--cs-text)] outline-none focus:border-[var(--cs-primary)]" /></label><select value={difficulty} onChange={(event) => { setDifficulty(event.target.value as LessonDifficulty | "all"); setPage(1); }} className="rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2.5 text-sm text-[var(--cs-text)]"><option value="all">All levels</option><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select><select value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }} className="rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2.5 text-sm text-[var(--cs-text)]"><option value="all">All categories</option>{categories.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}</select></div>{error ? <div role="alert" className="rounded-xl border border-rose-300/20 bg-rose-300/5 px-4 py-3 text-sm text-rose-100">{error}</div> : null}{isLoading ? <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-48 animate-pulse rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)]" />)}</div> : filteredCatalog.length ? <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{filteredCatalog.map((lesson) => <LessonCard key={lesson.id} lesson={lesson} progress={progress[lesson.remoteId ?? lesson.id]} isBookmarked={bookmarks.includes(lesson.remoteId ?? lesson.id)} onOpen={() => setSearchParams({ lesson: lesson.slug })} onBookmark={() => void toggleBookmark(lesson)} />)}</div> : <div className="rounded-2xl border border-dashed border-[var(--cs-border)] p-10 text-center"><BookOpen className="mx-auto h-8 w-8 text-[var(--cs-text-subtle)]" /><h3 className="mt-3 font-medium">No lessons match those filters.</h3><p className="mt-2 text-sm text-[var(--cs-text-muted)]">Try a broader search or choose another category.</p></div>}{hasMore ? <button type="button" onClick={() => setPage((current) => current + 1)} className="mx-auto flex items-center gap-2 rounded-xl border border-[var(--cs-border)] px-4 py-2.5 text-sm text-[var(--cs-text)]">Load more lessons <ArrowRight className="h-4 w-4" /></button> : null}</section>
  </div>;
};

const LessonCard = ({ lesson, progress, isBookmarked, onOpen, onBookmark }: { lesson: DisplayLesson; progress?: LocalProgress[string]; isBookmarked: boolean; onOpen: () => void; onBookmark: () => void }) => <article className="flex min-h-52 flex-col rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-5 transition hover:-translate-y-0.5 hover:border-[rgba(39,211,194,0.35)]"><div className="flex items-start justify-between gap-3"><span className="rounded-full border border-[var(--cs-border)] px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] text-[var(--cs-text-subtle)]">{lesson.difficulty}</span><button type="button" onClick={onBookmark} aria-label={isBookmarked ? "Remove bookmark" : "Bookmark lesson"} aria-pressed={isBookmarked} className={isBookmarked ? "text-[var(--cs-primary)]" : "text-[var(--cs-text-subtle)]"}><Bookmark className="h-4 w-4" fill={isBookmarked ? "currentColor" : "none"} /></button></div><div className="mt-4 text-xs text-[var(--cs-primary-bright)]">{lesson.categoryName}</div><h3 className="mt-2 text-lg font-semibold text-[var(--cs-text)]">{lesson.title}</h3><p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--cs-text-muted)]">{lesson.description}</p><div className="mt-auto flex items-center justify-between gap-3 pt-5"><span className="inline-flex items-center gap-1 text-xs text-[var(--cs-text-subtle)]"><Clock3 className="h-3.5 w-3.5" /> {lesson.estimatedDuration || 0} min</span><button type="button" onClick={onOpen} className="inline-flex items-center gap-1 text-sm font-medium text-[var(--cs-primary-bright)]">Open <ArrowRight className="h-4 w-4" /></button></div>{progress && progress.percentage > 0 ? <div className="mt-4"><div className="flex justify-between text-[11px] text-[var(--cs-text-subtle)]"><span>{progress.status === "completed" ? "Completed" : "In progress"}</span><span>{progress.percentage}%</span></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--cs-elevated)]"><div className="h-full rounded-full bg-[var(--cs-primary)]" style={{ width: `${progress.percentage}%` }} /></div></div> : null}</article>;

const LessonDetail = ({ lesson, progress, isBookmarked, canSync, onBack, onBookmark, onComplete, onProgress }: { lesson: DisplayLesson; progress?: LocalProgress[string]; isBookmarked: boolean; canSync: boolean; onBack: () => void; onBookmark: () => void; onComplete: () => void; onProgress: (progress: LocalProgress[string]) => void }) => {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const local = lesson.local;
  const content = lesson.content ?? {};
  const objectives = local?.objectives ?? asStringArray(content.objectives);
  const introduction = local?.introduction ?? asString(content.introduction, "This lesson introduces a focused programming concept.");
  const explanation = local?.simpleExplanation ?? asString(content.explanation, asString(content.simple_explanation, "Read the concept, then apply it in the example."));
  const technical = local?.technicalExplanation ?? asString(content.technicalExplanation, asString(content.technical_explanation, explanation));
  const code = local?.exampleCode ?? asString(content.exampleCode, asString(content.code));
  const notes = local?.exampleNotes ?? asString(content.exampleNotes, asString(content.keyTakeaways));
  const mistakes = local?.commonMistakes ?? asStringArray(content.commonMistakes);
  const applications = local?.applications ?? asStringArray(content.applications);
  const recordProgress = (percentage: number, position: number) => {
    const next: LocalProgress[string] = { percentage: Math.min(100, Math.max(1, percentage)), position, status: percentage >= 100 ? "completed" : "in_progress" };
    onProgress(next);
    if (lesson.remoteId && canSync) {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => { void updateLessonProgress(lesson.remoteId!, { progressPercentage: next.percentage, lastPosition: next.position, status: next.status }); }, 1000);
    }
  };
  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);
  return <article className="space-y-6"><button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm text-[var(--cs-text-muted)] hover:text-[var(--cs-text)]"><ArrowLeft className="h-4 w-4" /> Back to lessons</button><header className="rounded-3xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-6 sm:p-8"><div className="flex flex-wrap items-start justify-between gap-5"><div><div className="text-xs uppercase tracking-[0.16em] text-[var(--cs-primary-bright)]">{lesson.categoryName} · {lesson.difficulty}</div><h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">{lesson.title}</h1><p className="mt-4 max-w-3xl leading-7 text-[var(--cs-text-muted)]">{lesson.description}</p><div className="mt-4 flex items-center gap-3 text-xs text-[var(--cs-text-subtle)]"><Clock3 className="h-4 w-4" /> {lesson.estimatedDuration || 0} minute read</div></div><div className="flex items-center gap-2"><button type="button" onClick={onBookmark} aria-label={isBookmarked ? "Remove bookmark" : "Bookmark lesson"} className={isBookmarked ? "rounded-xl border border-[var(--cs-primary)] p-3 text-[var(--cs-primary)]" : "rounded-xl border border-[var(--cs-border)] p-3 text-[var(--cs-text-muted)]"}><Bookmark className="h-4 w-4" fill={isBookmarked ? "currentColor" : "none"} /></button><button type="button" onClick={onComplete} className="inline-flex items-center gap-2 rounded-xl bg-[var(--cs-primary)] px-3 py-3 text-xs font-semibold text-[#061114]"><CheckCircle2 className="h-4 w-4" /> Complete</button></div></div>{progress ? <div className="mt-6"><div className="flex justify-between text-xs text-[var(--cs-text-subtle)]"><span>{progress.status === "completed" ? "Completed" : "Reading progress"}</span><span>{progress.percentage}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--cs-elevated)]"><div className="h-full rounded-full bg-[var(--cs-primary)]" style={{ width: `${progress.percentage}%` }} /></div></div> : null}</header><div className="grid gap-5 lg:grid-cols-[minmax(0,1fr),15rem]"><div className="space-y-5"><LessonSection title="Learning objectives"><ul className="grid gap-2 sm:grid-cols-2">{objectives.map((item) => <li key={item} className="rounded-xl border border-[var(--cs-border)] p-3 text-sm">{item}</li>)}</ul></LessonSection><LessonSection title="Introduction"><p>{introduction}</p></LessonSection><LessonSection title="Explanation"><p>{explanation}</p><details className="mt-4 rounded-xl border border-[var(--cs-border)] p-3"><summary className="cursor-pointer text-sm font-medium text-[var(--cs-text)]">Developer explanation</summary><p className="mt-3">{technical}</p></details></LessonSection>{code ? <LessonSection title="Code example"><pre className="overflow-x-auto rounded-xl bg-[#080c10] p-4 font-mono text-sm leading-6 text-[#d6e5ef]"><code>{code}</code></pre><p className="mt-3 text-sm">{notes}</p></LessonSection> : null}{mistakes.length ? <LessonSection title="Common mistakes"><ul className="space-y-2">{mistakes.map((item) => <li key={item}>• {item}</li>)}</ul></LessonSection> : null}{applications.length ? <LessonSection title="Practical applications"><ul className="space-y-2">{applications.map((item) => <li key={item}>• {item}</li>)}</ul></LessonSection> : null}{local?.quiz ? <LessonQuiz lesson={local} /> : <div className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-5 text-sm text-amber-100"><LockKeyhole className="mb-2 h-4 w-4" />Secure quiz submission will be available after the trusted scoring migration is applied.</div>}</div><aside className="h-fit rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-4"><div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--cs-text-subtle)]">On this page</div><nav className="mt-3 space-y-2 text-sm text-[var(--cs-text-muted)]"><a href="#objectives" className="block hover:text-[var(--cs-text)]">Objectives</a><a href="#introduction" className="block hover:text-[var(--cs-text)]">Introduction</a><a href="#explanation" className="block hover:text-[var(--cs-text)]">Explanation</a><a href="#example" className="block hover:text-[var(--cs-text)]">Example</a></nav></aside></div></article>;
};

const LessonSection = ({ title, children }: { title: string; children: ReactNode }) => <section className="rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-5"><h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--cs-text-subtle)]">{title}</h2><div className="mt-3 text-sm leading-7 text-[var(--cs-text-muted)]">{children}</div></section>;
const LessonQuiz = ({ lesson }: { lesson: Lesson }) => { const [answer, setAnswer] = useState<number | null>(null); const [submitted, setSubmitted] = useState(false); return <section className="rounded-2xl border border-[rgba(39,211,194,0.25)] bg-[rgba(39,211,194,0.06)] p-5"><div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--cs-primary-bright)]">Knowledge check</div><h2 className="mt-2 font-medium text-[var(--cs-text)]">{lesson.quiz.question}</h2><div className="mt-4 grid gap-2 sm:grid-cols-2">{lesson.quiz.options.map((option, index) => <button key={option} type="button" onClick={() => { setAnswer(index); setSubmitted(false); }} className={`rounded-xl border px-3 py-3 text-left text-sm ${answer === index ? "border-[var(--cs-primary)] bg-[rgba(39,211,194,0.12)]" : "border-[var(--cs-border)]"}`}>{option}</button>)}</div><button type="button" disabled={answer === null} onClick={() => setSubmitted(true)} className="mt-4 rounded-lg bg-[var(--cs-primary)] px-4 py-2.5 text-sm font-semibold text-[#061114] disabled:opacity-40">Check answer</button>{submitted ? <p className="mt-4 text-sm text-[var(--cs-text-muted)]">{answer === lesson.quiz.answer ? "Correct." : "Not quite."} {lesson.quiz.explanation}</p> : null}</section>; };
