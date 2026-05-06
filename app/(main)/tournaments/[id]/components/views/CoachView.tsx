"use client";

import React from 'react';
import PlayerView from './PlayerView';

/**
 * Vista para entrenadores
 * Por ahora hereda de PlayerView ya que tienen permisos similares
 */
const CoachView: React.FC = () => {
  return <PlayerView />;
};

export default CoachView; 