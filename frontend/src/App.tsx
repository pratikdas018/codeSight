import { Suspense, lazy, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AuthConfirmScreen } from "./components/AuthConfirmScreen";
import { AppStatusScreen } from "./components/AppStatusScreen";
import { AuthScreen } from "./components/AuthScreen";
import { ToastViewport } from "./components/ToastViewport";
import { useAuth } from "./hooks/useAuth";
import { hasSupabaseConfig, SUPABASE_CONFIG_ERROR } from "./lib/supabase";
import type { Notice } from "./utils/types";

const HomePage = lazy(() =>
  import("./pages/HomePage").then((module) => ({
    default: module.HomePage,
  })),
);

const App = () => {
  const [notice, setNotice] = useState<Notice | null>(null);
  const isAuthConfirmRoute = window.location.pathname === "/auth/confirm";
  const {
    user,
    pendingConfirmationEmail,
    isLoading,
    isAuthenticating,
    authenticate,
    resendConfirmation,
  } = useAuth();

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
      <ToastViewport notice={notice} onDismiss={() => setNotice(null)} />
    </>
  );
};

export default App;
