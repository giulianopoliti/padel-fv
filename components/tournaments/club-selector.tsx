"use client"

import { Building2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

interface Club {
  id: string;
  name: string;
  source: 'owned' | 'organization';
}

interface ClubSelectorProps {
  userRole: string | null;
  clubs: Club[];
  selectedClubId: string;
  onClubChange: (clubId: string) => void;
  disabled?: boolean;
}

export function ClubSelector({ 
  userRole, 
  clubs, 
  selectedClubId, 
  onClubChange, 
  disabled = false 
}: ClubSelectorProps) {
  // Don't render anything if no role or no clubs
  if (!userRole || (!['ORGANIZADOR', 'CLUB'].includes(userRole))) {
    return null;
  }

  // For ORGANIZADOR: Show dropdown to select club
  if (userRole === 'ORGANIZADOR') {
    return (
      <div>
        <Label htmlFor="club_id" className="text-sm font-medium">
          <Building2 className="h-4 w-4 inline mr-1" />
          Club *
        </Label>
        <Select 
          name="club_id" 
          onValueChange={onClubChange} 
          value={selectedClubId} 
          disabled={disabled}
          required
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Selecciona un club" />
          </SelectTrigger>
          <SelectContent>
            {clubs.map(club => (
              <SelectItem key={club.id} value={club.id}>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  {club.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {clubs.length === 0 && (
          <p className="text-sm text-red-600 mt-1">
            No tienes clubes asociados a tu organización
          </p>
        )}
      </div>
    );
  }

  // For CLUB: Show read-only display of their club
  if (userRole === 'CLUB' && clubs.length > 0) {
    return (
      <div>
        <Label htmlFor="club_display" className="text-sm font-medium">
          <Building2 className="h-4 w-4 inline mr-1" />
          Tu Club
        </Label>
        <Input
          id="club_display"
          value={clubs[0]?.name || ''}
          disabled
          className="mt-1 bg-gray-50"
        />
      </div>
    );
  }

  return null;
}