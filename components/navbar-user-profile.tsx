"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogOut, Loader2 } from "lucide-react";
import { useUser } from "@/contexts/user-context";
import { useToast } from "@/components/ui/use-toast";
import type { User as AuthUser } from "@supabase/supabase-js";
import { getIcon, IconName } from "@/components/icons";
import { getStorageUrl } from "@/utils/storage-url";

interface NavLink {
  label: string;
  icon: string;
  path: string;
}
interface NavbarUserProfileProps {
  profileLinks?: NavLink[];
  params?: {
    id?: string;
  };
}
export default function NavbarUserProfile({ profileLinks = [], params }: NavbarUserProfileProps) {
  const { user, logout, userDetails } = useUser();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleLogout = async () => {
    if (isLoggingOut) {
      console.log("[NavbarUserProfile] Logout already in progress, ignoring...");
      return; // Prevent double logout
    }
    
    console.log("[NavbarUserProfile] Starting optimistic logout...");
    setIsLoggingOut(true);
    
    // Show immediate feedback
    toast({
      title: "Cerrando sesión...",
      description: "Un momento por favor",
    });
    
    try {
      console.log("[NavbarUserProfile] Calling logout function...");
      await logout();
      
      console.log("[NavbarUserProfile] Logout successful, showing success message...");
      
      // Show success message
      toast({
        title: "Sesión cerrada",
        description: "Has cerrado sesión exitosamente",
      });
      
      // Use smooth navigation instead of hard redirect
      router.push("/login");
      
    } catch (error) {
      console.error("[NavbarUserProfile] Error logging out:", error);
      
      // Show error message
      toast({
        title: "Error al cerrar sesión",
        description: "Intenta de nuevo o recarga la página",
        variant: "destructive",
      });
      
      // Fallback to hard redirect only if needed
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          console.log("[NavbarUserProfile] Fallback redirect after error...");
          window.location.href = "/login";
        }
      }, 2000);
      
    } finally {
      // Keep loading state briefly for smooth transition
      setTimeout(() => {
        setIsLoggingOut(false);
      }, 500);
    }
  };

  if (!user || isLoggingOut) {
    // Show loading state during logout
    if (isLoggingOut) {
      return (
        <Button 
          variant="ghost" 
          className="relative rounded-full p-0 h-10 w-10 text-white hover:bg-gray-800 focus-visible:ring-white focus-visible:ring-offset-0 focus-visible:ring-offset-gray-900"
          disabled
        >
          <Avatar className="h-9 w-9 opacity-50">
            <AvatarFallback className="bg-gray-600 text-white">
              <Loader2 className="h-4 w-4 animate-spin" />
            </AvatarFallback>
          </Avatar>
        </Button>
      );
    }
    return null;
  }

  const getInitials = () => {
    const UDetails = userDetails as any;
    if (UDetails && typeof UDetails.first_name === 'string' && UDetails.first_name && typeof UDetails.last_name === 'string' && UDetails.last_name) {
      return `${UDetails.first_name[0]}${UDetails.last_name[0]}`.toUpperCase();
    }
    if (UDetails && typeof UDetails.name === 'string' && UDetails.name) {
      return UDetails.name.substring(0, 2).toUpperCase();
    }
    if (user?.email) return user.email.substring(0, 2).toUpperCase();
    return "U";
  };

  const getLogoUrl = () => {
    const UDetails = userDetails as any;
    console.log('[NavbarUserProfile] getLogoUrl check:', {
      hasDetails: !!UDetails,
      role: UDetails?.role,
      hasLogoUrl: !!UDetails?.logo_url,
      logoUrl: UDetails?.logo_url,
      fullDetails: UDetails
    });
    // For ORGANIZADOR role, return logo_url if exists
    if (UDetails && UDetails.role === 'ORGANIZADOR' && UDetails.logo_url) {
      const proxiedUrl = getStorageUrl(UDetails.logo_url);
      console.log('[NavbarUserProfile] Returning proxied logo URL:', proxiedUrl);
      return proxiedUrl;
    }
    console.log('[NavbarUserProfile] No logo URL found, using initials');
    return null;
  };

  const displayName = 
    (userDetails && typeof (userDetails as any).first_name === 'string' && (userDetails as any).first_name) ||
    (userDetails && typeof (userDetails as any).name === 'string' && (userDetails as any).name) ||
    user.email?.split('@')[0] || 
    "Usuario";

  const userEmail = user.email || "No email available";
  const userIdShort = user.id.substring(0, 8);

  const logoUrl = getLogoUrl();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative rounded-full p-0 h-10 w-10 text-white hover:bg-gray-800 focus-visible:ring-white focus-visible:ring-offset-0 focus-visible:ring-offset-gray-900">
          {logoUrl ? (
            <div className="h-9 w-9 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
              <img
                src={logoUrl}
                alt="Organization Logo"
                className="h-full w-full object-cover"
                onError={(e) => {
                  console.log('[NavbarUserProfile] Image failed to load:', logoUrl);
                  console.log('[NavbarUserProfile] Error details:', e.currentTarget.src);
                  e.currentTarget.style.display = 'none';
                }}
                onLoad={() => {
                  console.log('[NavbarUserProfile] Image loaded successfully!', logoUrl);
                }}
              />
            </div>
          ) : (
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-blue-600 text-sm font-semibold text-white">{getInitials()}</AvatarFallback>
            </Avatar>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 bg-white border-gray-200 shadow-lg rounded-md mt-1">
        <DropdownMenuLabel className="px-3 py-2.5">
          <div className="flex flex-col space-y-0.5">
            <p className="text-sm font-semibold leading-none text-gray-800 truncate" title={displayName}>{displayName}</p>
            <p className="text-xs leading-none text-gray-500 truncate" title={userEmail}>
              {userEmail}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-gray-100" />
        
        {profileLinks.map(link => {
          const IconComponent = getIcon(link.icon as IconName);
          return (
            <DropdownMenuItem key={link.path} asChild>
              <Link href={link.path} className="cursor-pointer flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-sm focus:bg-gray-100 focus:text-gray-900">
                {IconComponent && <IconComponent className="mr-2.5 h-4 w-4 text-gray-500" />}
                <span>{link.label}</span>
              </Link>
            </DropdownMenuItem>
          );
        })}
        
        {profileLinks.length > 0 && <DropdownMenuSeparator className="bg-gray-100"/>}
        
        <DropdownMenuItem
          className="text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer flex items-center px-3 py-2 text-sm rounded-sm"
          onClick={handleLogout}
          disabled={isLoggingOut}
        >
          {isLoggingOut ? (
            <Loader2 className="mr-2.5 h-4 w-4 animate-spin" />
          ) : (
            <LogOut className="mr-2.5 h-4 w-4" />
          )}
          <span>{isLoggingOut ? "Cerrando sesión..." : "Cerrar Sesión"}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 