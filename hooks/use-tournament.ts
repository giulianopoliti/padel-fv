import { useState, useEffect } from "react";
import { Database } from "@/database.types";
import { getTournamentDetailsWithInscriptions } from "@/app/api/tournaments/actions";

type Tournament = Database["public"]["Tables"]["tournaments"]["Row"] & {
  clubes?: {
    id: string;
    name: string;
    address: string | null;
    cover_image_url: string | null;
    phone: string | null;
    email: string | null;
  };
  categories?: {
    name: string;
  };
  winner_image_url?: string | null;
  pre_image_url?: string | null;
};

export const useTournament = (id: string) => {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (!id) {
      setIsLoading(false);
      setError(new Error("Tournament ID is required"));
      return;
    }

    const fetchTournament = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getTournamentDetailsWithInscriptions(id);
        if (isMounted) {
          setTournament(data.tournament);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error("Failed to fetch tournament"));
          setTournament(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchTournament();

    return () => {
      isMounted = false;
    };
  }, [id]);

  return { tournament, isLoading, error };
}; 