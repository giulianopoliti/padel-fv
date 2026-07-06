import Image from "next/image"
import { cn } from "@/lib/utils"

const sponsors = [
  {
    name: "Marathon Isotonica",
    src: "/tenants/padel-fv/sponsors/marathon-provided.png",
    width: 537,
    height: 465,
    className: "h-20 w-24 sm:h-24 sm:w-28",
  },
  {
    name: "Sixty",
    src: "/tenants/padel-fv/sponsors/sixty-provided.png",
    width: 235,
    height: 205,
    className: "h-16 w-24 sm:h-20 sm:w-28",
  },
  {
    name: "Al Buen Tallarin de Pablo",
    src: "/tenants/padel-fv/sponsors/al-buen-tallarin-provided.png",
    width: 901,
    height: 277,
    className: "h-16 w-56 sm:h-20 sm:w-72",
  },
  {
    name: "Pizza Nonna",
    src: "/tenants/padel-fv/sponsors/pizza-nonna-provided.png",
    width: 793,
    height: 315,
    className: "h-16 w-56 sm:h-20 sm:w-72",
  },
] as const

interface SponsorMarqueeProps {
  className?: string
}

export default function SponsorMarquee({ className }: SponsorMarqueeProps) {
  const marqueeSponsors = [...sponsors, ...sponsors]

  return (
    <section
      aria-label="Sponsors"
      className={cn(
        "group overflow-hidden border-y border-white/12 bg-white/[0.04] py-5 backdrop-blur-sm",
        className,
      )}
    >
      <div className="mb-4 flex justify-center px-4">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-court-300">
          Sponsors
        </p>
      </div>

      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[#162545] to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[#162545] to-transparent" />

        <div className="flex w-max motion-safe:animate-sponsor-marquee group-hover:[animation-play-state:paused]">
          {marqueeSponsors.map((sponsor, index) => (
            <div
              key={`${sponsor.name}-${index}`}
              className="mx-3 flex h-24 flex-none items-center justify-center px-5 sm:mx-4 sm:h-28"
              aria-hidden={index >= sponsors.length}
            >
              <Image
                src={sponsor.src}
                alt={sponsor.name}
                width={sponsor.width}
                height={sponsor.height}
                sizes="(max-width: 640px) 224px, 288px"
                className={cn("object-contain", sponsor.className)}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
