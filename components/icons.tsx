import {
  Home, Trophy, Users, Layers, MapPin, Settings, BarChart, User as UserIcon, LogOut, CheckCircle, Calendar, Plus, ListChecks, ChevronRight, Search, ClipboardList, LogIn, UserPlus, Clock, LayoutDashboard
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type IconName =
  | 'Home' 
  | 'Trophy' 
  | 'Users' 
  | 'Layers' // For Categories
  | 'MapPin' // For Club
  | 'Settings'
  | 'BarChart' // For Ranking
  | 'User' // For Profile Icon
  | 'LogOut'
  | 'CheckCircle'
  | 'Calendar'
  | 'Plus'
  | 'ListChecks'
  | 'ChevronRight'
  | 'Search'
  | 'ClipboardList'
  | 'LogIn'
  | 'UserPlus'
  | 'Clock'
  | 'LayoutDashboard'; // For Dashboard

const iconMap: Record<IconName, LucideIcon> = {
  Home,
  Trophy,
  Users,
  Layers,
  MapPin,
  Settings,
  BarChart,
  User: UserIcon, // "User" es un nombre común, así que usamos UserIcon de lucide
  LogOut,
  CheckCircle,
  Calendar,
  Plus,
  ListChecks,
  ChevronRight,
  Search,
  ClipboardList,
  LogIn,
  UserPlus,
  Clock,
  LayoutDashboard
};

export function getIcon(name?: IconName): LucideIcon | null {
  if (!name || !iconMap[name]) return null;
  return iconMap[name];
} 