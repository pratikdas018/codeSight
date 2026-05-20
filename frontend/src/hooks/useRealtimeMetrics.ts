import { useEffect } from "react";
import {
  subscribeToAdminRealtime,
  unsubscribeRealtimeChannel,
} from "../services/analyticsService";

export const useRealtimeMetrics = (onRefresh: () => void) => {
  useEffect(() => {
    const channel = subscribeToAdminRealtime(onRefresh);

    return () => {
      void unsubscribeRealtimeChannel(channel);
    };
  }, [onRefresh]);
};
