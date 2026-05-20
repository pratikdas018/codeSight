import { useEffect, useState, type FormEvent } from "react";
import {
  feedbackCategories,
  feedbackCategoryLabels,
  type FeedbackCategory,
} from "../services/feedbackService";
import { DrawerPanel } from "./DrawerPanel";

interface FeedbackPanelProps {
  initialEmail: string;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    category: FeedbackCategory;
    email: string;
    message: string;
  }) => Promise<void> | void;
  open: boolean;
}

export const FeedbackPanel = ({
  initialEmail,
  isSubmitting,
  onClose,
  onSubmit,
  open,
}: FeedbackPanelProps) => {
  const [email, setEmail] = useState(initialEmail);
  const [category, setCategory] = useState<FeedbackCategory>("bug_report");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    setEmail(initialEmail);
    setCategory("bug_report");
    setMessage("");
  }, [initialEmail, open]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit({
      category,
      email,
      message,
    });
  };

  return (
    <DrawerPanel
      open={open}
      onClose={onClose}
      icon="chat_bubble"
      title="Share Feedback"
      description="Send us a bug report, workflow idea, or UX note. Feedback is sent to CodeSight analytics in Supabase so admins can triage it."
      footer={
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] px-4 py-3 text-sm text-[var(--cs-text-muted)]">
          <span>Stored securely in Supabase for admin review.</span>
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--cs-text-subtle)]">
            Admin triage
          </span>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-[1.5rem] border border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] p-4">
          <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--cs-text-subtle)]">
            Contact
          </div>
          <label className="mt-3 block text-sm text-[var(--cs-text-muted)]">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="cs-input mt-2"
              autoComplete="email"
              required
            />
          </label>
        </div>

        <div className="rounded-[1.5rem] border border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] p-4">
          <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--cs-text-subtle)]">
            Category
          </div>
          <label className="mt-3 block text-sm text-[var(--cs-text-muted)]">
            What kind of feedback is this?
            <select
              value={category}
              onChange={(event) =>
                setCategory(event.target.value as FeedbackCategory)
              }
              className="cs-input mt-2"
            >
              {feedbackCategories.map((value) => (
                <option
                  key={value}
                  value={value}
                  className="bg-[#0b0f0b] text-[var(--cs-text)]"
                >
                  {feedbackCategoryLabels[value]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="rounded-[1.5rem] border border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--cs-text-subtle)]">
              Details
            </div>
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--cs-text-subtle)]">
              {message.trim().length} chars
            </div>
          </div>
          <label className="mt-3 block text-sm text-[var(--cs-text-muted)]">
            What happened, or what would you like improved?
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Tell us what you were trying to do, what you expected, and what CodeSight showed instead."
              className="cs-input mt-2 min-h-[12rem] resize-y"
              required
            />
          </label>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-sm leading-6 text-[var(--cs-text-muted)]">
            Include the step you were on, the language you selected, and what felt confusing. That makes learning UX issues much easier to reproduce.
          </p>
          <button
            type="submit"
            disabled={isSubmitting || !email.trim() || !message.trim()}
            className="cs-button cs-button-primary min-w-[9rem] rounded-2xl px-4 py-3 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-[18px]">send</span>
            {isSubmitting ? "Sending..." : "Send"}
          </button>
        </div>
      </form>
    </DrawerPanel>
  );
};
