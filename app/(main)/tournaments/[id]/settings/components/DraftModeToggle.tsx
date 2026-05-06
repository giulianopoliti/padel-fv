'use client'

import { useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

interface DraftModeToggleProps {
  tournamentId: string
  initialIsDraft: boolean
}

export default function DraftModeToggle({ tournamentId, initialIsDraft }: DraftModeToggleProps) {
  const [isDraft, setIsDraft] = useState(initialIsDraft)
  const [loading, setLoading] = useState(false)

  const handleToggle = async (checked: boolean) => {
    setLoading(true)
    const res = await fetch(`/api/tournaments/${tournamentId}/draft`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_draft: checked })
    })
    if (res.ok) {
      setIsDraft(checked)
    }
    setLoading(false)
  }

  return (
    <div className="flex items-center gap-4">
      <Switch
        id="draft-mode"
        checked={isDraft}
        onCheckedChange={handleToggle}
        disabled={loading}
      />
      <div>
        <Label htmlFor="draft-mode" className="text-sm font-medium">
          Modo Borrador
        </Label>
        <p className="text-xs text-muted-foreground mt-0.5">
          {isDraft
            ? 'Activado — los demás no lo ven'
            : 'Desactivado — los demás lo ven'}
        </p>
      </div>
    </div>
  )
}
