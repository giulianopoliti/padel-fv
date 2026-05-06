import Image from "next/image"
import { getTenantBranding } from "@/config/tenant"

interface BrandLogoProps {
  variant?: "navbar" | "hero"
  className?: string
  priority?: boolean
}

export default function BrandLogo({
  variant = "navbar",
  className,
  priority = true,
}: BrandLogoProps) {
  const branding = getTenantBranding()
  const src = variant === "hero" ? branding.logo.hero : branding.logo.navbar
  const alt = `${branding.siteName} logo`

  return (
    <Image
      src={src}
      alt={alt}
      width={variant === "hero" ? 320 : 220}
      height={variant === "hero" ? 120 : 56}
      className={className || (variant === "hero" ? "h-24 w-auto" : "h-14 w-auto")}
      style={{ width: "auto", height: "auto", maxHeight: variant === "hero" ? "96px" : "56px" }}
      priority={priority}
    />
  )
}
