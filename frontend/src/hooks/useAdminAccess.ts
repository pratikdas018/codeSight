import { useEffect, useState } from "react";
import { requireSupabase } from "../lib/supabase";
import { useAuth } from "./useAuth";

export const useAdminAccess = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [role, setRole] = useState<string>("user");

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!user) {
        if (isMounted) {
          setIsAdmin(false);
          setRole("guest");
          setIsLoading(false);
        }
        return;
      }

      const { data, error } = await requireSupabase()
        .from("profiles")
        .select("is_admin, role")
        .eq("id", user.id)
        .single();

      if (!isMounted) {
        return;
      }

      if (error) {
        setIsAdmin(false);
        setRole("user");
      } else {
        setIsAdmin(Boolean(data.is_admin));
        setRole(data.role ?? "user");
      }

      setIsLoading(false);
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [user]);

  return { isLoading, isAdmin, role };
};

