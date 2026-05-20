import { motion } from "framer-motion";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

export const MetricCard = ({
  label,
  value,
  hint,
  delta,
  accent = "success",
}: {
  label: string;
  value: string;
  hint: string;
  delta?: string;
  accent?: "success" | "warning" | "danger" | "info";
}) => (
  <motion.div
    initial={{ opacity: 0, y: 14 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.26, ease: "easeOut" }}
  >
    <Card className="group h-full overflow-hidden">
      <CardHeader className="pb-3 sm:pb-4">
        <div className="flex items-center justify-between gap-3">
          <Badge variant={accent}>{label}</Badge>
          <div className="h-9 w-9 rounded-2xl border border-[rgba(114,255,112,0.16)] bg-[radial-gradient(circle_at_30%_30%,rgba(114,255,112,0.2),transparent_60%)] shadow-[0_0_32px_rgba(0,255,65,0.12)] transition group-hover:scale-105 sm:h-10 sm:w-10" />
        </div>
        <CardTitle className="text-3xl tracking-[-0.06em] sm:text-4xl">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-6 text-[var(--cs-text-muted)]">{hint}</p>
        {delta ? (
          <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[var(--cs-text-subtle)]">
            {delta}
          </p>
        ) : null}
      </CardContent>
    </Card>
  </motion.div>
);
