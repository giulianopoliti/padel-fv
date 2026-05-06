import { useUser } from "@/contexts/user-context";
import { Database } from "@/database.types";
import { useEffect, useState } from "react";
import { checkTournamentPermissions } from "@/utils/tournament-permissions";

type Tournament = Database["public"]["Tables"]["tournaments"]["Row"];

/**
 * Hook para verificar si un torneo es editable por el usuario actual
 * ACTUALIZADO: Soporta CLUB (owner directo) + ORGANIZADOR (miembro de organización) + ADMIN
 */
export const useTournamentEditable = (tournament?: Tournament | null) => {
  const { user, userDetails } = useUser();
  const [isEditable, setIsEditable] = useState(false);

  useEffect(() => {
    const checkEditPermissions = async () => {
      if (!tournament || !user || !userDetails) {
        setIsEditable(false);
        return;
      }

      // Para ADMIN, siempre es editable
      if (userDetails.role === "ADMIN") {
        setIsEditable(true);
        return;
      }

      // Para CLUB, verificar ownership directo
      if (userDetails.role === "CLUB") {
        const isOwner = tournament.club_id === userDetails.club_id;
        setIsEditable(isOwner);
        return;
      }

      // Para ORGANIZADOR, verificar permisos vía la función centralizada
      if (userDetails.role === "ORGANIZADOR") {
        try {
          const result = await checkTournamentPermissions(user.id, tournament.id);
          setIsEditable(result.hasPermission);
        } catch (error) {
          console.error("Error checking organizer permissions:", error);
          setIsEditable(false);
        }
        return;
      }

      // Otros roles no pueden editar
      setIsEditable(false);
    };

    checkEditPermissions();
  }, [tournament, user, userDetails]);

  return isEditable;
}; 