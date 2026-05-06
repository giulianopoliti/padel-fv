import type React from "react"
import { getUserRole } from "@/app/api/users"
import { redirect } from "next/navigation"

export default async function EditProfileLayout({
  children,
  player,
  club,
  coach,
  organizador,
}: {
  children: React.ReactNode
  player: React.ReactNode
  club: React.ReactNode
  coach: React.ReactNode
  organizador: React.ReactNode
}) {
  try {
    const userRole = await getUserRole()

    let contentToRender

    if (userRole === "PLAYER") {
      contentToRender = player
    } else if (userRole === "CLUB") {
      contentToRender = club
    } else if (userRole === "COACH") {
      contentToRender = coach
    } else if (userRole === "ORGANIZADOR") {
      contentToRender = organizador
    } else {
      // If role is undefined/null, show the main page (children)
      // which will handle profile completion
      console.log("[EditProfileLayout] No user role found, showing main page")
      contentToRender = children
    }

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">{contentToRender}</div>
      </div>
    )
  } catch (error) {
    // If getUserRole fails (auth issues), redirect to login
    console.error("[EditProfileLayout] Error getting user role:", error)
    redirect("/login")
  }
}
