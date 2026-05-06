"use client";

import React from 'react';
import {
  Avatar,
  AvatarFallback,
} from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface Player {
  first_name: string | null;
  last_name: string | null;
}

interface CoupleAvatarProps {
  player1: Player | null;
  player2: Player | null;
  size?: 'sm' | 'md' | 'lg';
  showNames?: boolean;
}

const CoupleAvatar: React.FC<CoupleAvatarProps> = ({
  player1,
  player2,
  size = 'md',
  showNames = false
}) => {
  const getInitials = (player: Player | null): string => {
    if (!player) return '?';
    const firstName = player.first_name?.charAt(0)?.toUpperCase() || '';
    const lastName = player.last_name?.charAt(0)?.toUpperCase() || '';
    return firstName + lastName || '??';
  };

  const getFullName = (player: Player | null): string => {
    if (!player) return 'N/A';
    return `${player.first_name || ''} ${player.last_name || ''}`.trim() || 'N/A';
  };

  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base'
  };

  const player1Initials = getInitials(player1);
  const player2Initials = getInitials(player2);
  const player1Name = getFullName(player1);
  const player2Name = getFullName(player2);

  // Colores alternados para las iniciales
  const player1Color = 'bg-purple-100 text-purple-700 border-purple-300';
  const player2Color = 'bg-blue-100 text-blue-700 border-blue-300';

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        {/* Avatares superpuestos */}
        <div className="flex items-center -space-x-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Avatar className={`${sizeClasses[size]} border-2 ${player1Color}`}>
                <AvatarFallback className={player1Color}>
                  {player1Initials}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs font-medium">{player1Name}</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Avatar className={`${sizeClasses[size]} border-2 ${player2Color}`}>
                <AvatarFallback className={player2Color}>
                  {player2Initials}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs font-medium">{player2Name}</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Nombres opcionales */}
        {showNames && (
          <div className="flex flex-col min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">
              {player1Name}
            </p>
            <p className="text-sm text-slate-600 truncate">
              {player2Name}
            </p>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};

export default CoupleAvatar;
