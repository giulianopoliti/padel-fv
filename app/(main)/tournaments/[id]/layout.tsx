import React from 'react'
import TournamentLongLayout from './components/TournamentLongLayout'

interface TournamentLayoutProps {
  children: React.ReactNode
}

export default function TournamentLayout({ children }: TournamentLayoutProps) {
  return (
    <TournamentLongLayout>
      {children}
    </TournamentLongLayout>
  )
}