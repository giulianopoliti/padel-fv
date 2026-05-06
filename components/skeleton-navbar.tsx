// 🚀 OPTIMIZACIÓN FASE 1.3: Skeleton navbar mejorado
export default function SkeletonNavbar() {
  return (
    <header className="sticky top-0 z-50 bg-gray-900 shadow-md">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-20">
          {/* Logo placeholder - más similar al real */}
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-white/20 rounded-full animate-pulse"></div>
            <div className="h-6 w-24 bg-white/20 rounded animate-pulse"></div>
          </div>
          
          {/* Navigation items placeholders - Desktop */}
          <div className="hidden lg:flex items-center space-x-2">
            <div className="h-10 w-20 bg-white/20 rounded-full animate-pulse"></div>
            <div className="h-10 w-24 bg-white/20 rounded-full animate-pulse"></div>
            <div className="h-10 w-20 bg-white/20 rounded-full animate-pulse"></div>
            <div className="h-10 w-20 bg-white/20 rounded-full animate-pulse"></div>
          </div>

          {/* Actions placeholder - Desktop */}
          <div className="hidden lg:flex items-center space-x-3">
            <div className="h-10 w-10 bg-white/20 rounded-full animate-pulse"></div>
          </div>

          {/* Mobile menu button placeholder */}
          <div className="lg:hidden">
            <div className="h-10 w-10 bg-white/20 rounded-full animate-pulse"></div>
          </div>
        </div>
      </div>
    </header>
  );
} 