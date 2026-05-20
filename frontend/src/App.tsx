import { Suspense, lazy, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AuthConfirmScreen } from "./components/AuthConfirmScreen";
import { AppStatusScreen } from "./components/AppStatusScreen";
import { AuthScreen } from "./components/AuthScreen";
import { ToastViewport } from "./components/ToastViewport";
import { useAdminAccess } from "./hooks/useAdminAccess";
import { useAuth } from "./hooks/useAuth";
import { hasSupabaseConfig, SUPABASE_CONFIG_ERROR } from "./lib/supabase";
import { captureCrashReportSafe, trackUserActivitySafe } from "./services/analyticsService";
import { createRendererLogger, logStructuredEntry } from "./utils/logger";
import type { Notice } from "./utils/types";

const HomePage = lazy(() =>
  import("./pages/HomePage").then((module) => ({
    default: module.HomePage,
  })),
);

const AdminLayout = lazy(() =>
  import("./pages/admin/AdminLayout").then((module) => ({
    default: module.AdminLayout,
  })),
);

const AdminOverviewPage = lazy(() =>
  import("./pages/admin/AdminOverviewPage").then((module) => ({
    default: module.AdminOverviewPage,
  })),
);

const AnalyticsPage = lazy(() =>
  import("./pages/admin/AnalyticsPage").then((module) => ({
    default: module.AnalyticsPage,
  })),
);

const UsersPage = lazy(() =>
  import("./pages/admin/UsersPage").then((module) => ({
    default: module.UsersPage,
  })),
);

const ExecutionsPage = lazy(() =>
  import("./pages/admin/ExecutionsPage").then((module) => ({
    default: module.ExecutionsPage,
  })),
);

const ErrorsPage = lazy(() =>
  import("./pages/admin/ErrorsPage").then((module) => ({
    default: module.ErrorsPage,
  })),
);

const FeedbackPage = lazy(() =>
  import("./pages/admin/FeedbackPage").then((module) => ({
    default: module.FeedbackPage,
  })),
);

const App = () => {
  const [notice, setNotice] = useState<Notice | null>(null);
  const rendererLogger = createRendererLogger("RENDERER");
  const isAuthConfirmRoute = window.location.pathname === "/auth/confirm";
  const {
    user,
    pendingConfirmationEmail,
    isLoading,
    isAuthenticating,
    authenticate,
    resendConfirmation,
  } = useAuth();
  const adminAccess = useAdminAccess();

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      rendererLogger.error("Unhandled renderer error.", event.error ?? event.message, {
        filename: event.filename,
        line: event.lineno,
        column: event.colno,
      });
      if (user?.id) {
        void captureCrashReportSafe({
          userId: user.id,
          errorMessage: event.message || "Unhandled renderer error",
          stackTrace: event.error?.stack ?? null,
          metadata: {
            filename: event.filename,
            line: event.lineno,
            column: event.colno,
          },
        });
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      rendererLogger.error("Unhandled renderer promise rejection.", event.reason, {});
      if (user?.id) {
        void captureCrashReportSafe({
          userId: user.id,
          errorMessage:
            event.reason instanceof Error
              ? event.reason.message
              : "Unhandled renderer promise rejection",
          stackTrace:
            event.reason instanceof Error ? event.reason.stack ?? null : null,
          metadata: {
            source: "promise_rejection",
          },
        });
      }
    };

    const unsubscribeSystemLog = window.electronAPI?.onSystemLog((entry) => {
      logStructuredEntry(entry);
    });

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      unsubscribeSystemLog?.();
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, [rendererLogger, user?.id]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    void trackUserActivitySafe({
      userId: user.id,
      action: "app_open",
      metadata: {
        route: window.location.hash || "#/",
      },
    });
  }, [user?.id]);

  if (!hasSupabaseConfig) {
    return (
      <AppStatusScreen
        eyebrow="Configuration"
        title="Supabase is required to open CodeSight."
        description={SUPABASE_CONFIG_ERROR}
      />
    );
  }

  if (isAuthConfirmRoute) {
    return <AuthConfirmScreen />;
  }

  return (
    <>
      <Routes>
        <Route
          path="/"
          element={
            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div key="loading" exit={{ opacity: 0 }}>
                  <AppStatusScreen
                    eyebrow="Launching"
                    title="Restoring your secure desktop session."
                    description="CodeSight checks for an existing Supabase session before the workspace can render."
                    showSpinner
                  />
                </motion.div>
              ) : user ? (
                <motion.div
                  key="workspace"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.24, ease: "easeOut" }}
                >
                  <Suspense
                    fallback={
                      <AppStatusScreen
                        eyebrow="Workspace"
                        title="Opening your CodeSight workspace."
                        description="The authenticated workspace is loading."
                        showSpinner
                      />
                    }
                  >
                    <HomePage onGlobalNotice={setNotice} />
                  </Suspense>
                </motion.div>
              ) : (
                <motion.div
                  key="auth"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.24, ease: "easeOut" }}
                >
                  <AuthScreen
                    isAuthenticating={isAuthenticating}
                    pendingConfirmationEmail={pendingConfirmationEmail}
                    onAuthenticate={authenticate}
                    onResendConfirmation={resendConfirmation}
                    onNotice={setNotice}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedAdminRoute
              isLoading={isLoading || adminAccess.isLoading}
              isAuthenticated={Boolean(user)}
              isAdmin={adminAccess.isAdmin}
            />
          }
        >
          <Route
            element={
              <Suspense
                fallback={
                  <AppStatusScreen
                    eyebrow="Admin"
                    title="Loading dashboard shell."
                    description="CodeSight is streaming the admin workspace."
                    showSpinner
                  />
                }
              >
                <AdminLayout />
              </Suspense>
            }
          >
            <Route
              index
              element={
                <Suspense fallback={<AdminRouteFallback title="Loading overview." />}>
                  <AdminOverviewPage />
                </Suspense>
              }
            />
            <Route
              path="analytics"
              element={
                <Suspense fallback={<AdminRouteFallback title="Loading analytics." />}>
                  <AnalyticsPage />
                </Suspense>
              }
            />
            <Route
              path="users"
              element={
                <Suspense fallback={<AdminRouteFallback title="Loading users." />}>
                  <UsersPage />
                </Suspense>
              }
            />
            <Route
              path="executions"
              element={
                <Suspense fallback={<AdminRouteFallback title="Loading executions." />}>
                  <ExecutionsPage />
                </Suspense>
              }
            />
            <Route
              path="errors"
              element={
                <Suspense fallback={<AdminRouteFallback title="Loading errors." />}>
                  <ErrorsPage />
                </Suspense>
              }
            />
            <Route
              path="feedback"
              element={
                <Suspense fallback={<AdminRouteFallback title="Loading feedback." />}>
                  <FeedbackPage />
                </Suspense>
              }
            />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastViewport notice={notice} onDismiss={() => setNotice(null)} />
    </>
  );
};

export default App;

const ProtectedAdminRoute = ({
  isLoading,
  isAuthenticated,
  isAdmin,
}: {
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
}) => {
  if (isLoading) {
    return (
      <AppStatusScreen
        eyebrow="Admin"
        title="Validating admin session."
        description="CodeSight is checking your session and role-based permissions."
        showSpinner
      />
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (!isAdmin) {
    return (
      <AppStatusScreen
        eyebrow="Access denied"
        title="This route is reserved for CodeSight admins."
        description="Set `profiles.is_admin = true` for your account in Supabase before opening the dashboard."
      />
    );
  }

  return <Outlet />;
};

const AdminRouteFallback = ({ title }: { title: string }) => (
  <AppStatusScreen
    eyebrow="Admin"
    title={title}
    description="The dashboard module is being prepared."
    showSpinner
  />
);
