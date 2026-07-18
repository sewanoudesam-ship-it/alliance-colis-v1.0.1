import { useEffect, useState, useCallback } from "react";
import { getProfile } from "../services/profileService";
import type { Profile } from "../types";

export default function useProfile(userId?: string) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const data = await getProfile(userId);
    setProfile(data);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { profile, role: profile?.role ?? null, loading, refresh };
}
