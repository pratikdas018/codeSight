import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";

const KEYWORDS = /\b(function|return|const|let|var|if|else|for|while|class|public|static|void|int|def|print|console|include|import|new)\b/g;
const STRINGS = /(".*?"|'.*?')/g;
const COMMENTS = /(\/\/.*$|#.*$)/gm;

const highlightCode = (source: string) =>
  source
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(COMMENTS, '<span class="text-[#6f8a71]">$1</span>')
    .replace(STRINGS, '<span class="text-[#a8f5ff]">$1</span>')
    .replace(KEYWORDS, '<span class="text-[#72ff70]">$1</span>');

export const CodePreviewDialog = ({
  open,
  onOpenChange,
  title,
  description,
  code,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  code: string;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--cs-border)] bg-[#050505]">
        <pre
          className="max-h-[60vh] overflow-auto p-5 font-mono text-sm leading-7 text-[var(--cs-text)]"
          dangerouslySetInnerHTML={{ __html: highlightCode(code) }}
        />
      </div>
    </DialogContent>
  </Dialog>
);
