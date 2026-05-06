"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient, createClientServiceRole } from "@/utils/supabase/server";

import { Provider } from "@supabase/supabase-js";
import { getURL } from "@/utils/supabase/helpers";
import { getUser } from "@/app/api/users";
export async function emaillogin(formData: FormData) {
  const supabase = await createClient();

  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  console.log("[ServerAction] Attempting login with email:", data.email);
  
  try {
    const { data: session, error } = await supabase.auth.signInWithPassword(data);

    if (error) {
      console.error("[ServerAction] Login error:", error.message);
      return { success: false, error: "Credenciales incorrectas" };
    }

    console.log("[ServerAction] Login successful, session established:", 
      session.session ? `User ID: ${session.session.user.id}` : "No session created");
    
    // Check if the session was actually created
    if (!session.session) {
      console.error("[ServerAction] No session was created despite successful auth");
      return { success: false, error: "Error interno: No se pudo crear sesión" };
    }

    revalidatePath("/", "layout");
    return {
      success: true,
      token: session.session.access_token,
      redirect: "/home",
    };
  } catch (unexpectedError) {
    console.error("[ServerAction] Unexpected error during login:", unexpectedError);
    return { success: false, error: "Error interno del servidor" };
  }
}

export async function signup(formData: FormData) {
  const supabase = await createClient();

  // type-casting here for convenience
  // in practice, you should validate your inputs
  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const { error } = await supabase.auth.signUp(data);

  if (error) {
    redirect("/error");
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signout() {
  try {
    console.log("[ServerAction] Performing signout");
    const supabase = await createClient();
    
    // Get current session before logout for debugging and cache clearing
    const { data: sessionBefore } = await supabase.auth.getSession();
    const userId = sessionBefore.session?.user?.id;
    console.log("[ServerAction] Session before logout:", sessionBefore.session ? `User: ${userId}` : 'none');
    
    // Sign out from Supabase (this should clear cookies)
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    
    if (error) {
      console.error("[ServerAction] Signout error:", error);
      return { success: false, error: error.message };
    }
    
    // Clear middleware cache if we have a userId
    if (userId) {
      try {
        // Import and call cache clearing function
        const { clearUserCache } = await import("@/utils/supabase/middleware");
        clearUserCache(userId);
      } catch (cacheError) {
        console.warn("[ServerAction] Could not clear middleware cache:", cacheError);
        // Don't fail logout for cache clearing issues
      }
    }
    
    // Verify logout worked by checking session again
    const { data: sessionAfter } = await supabase.auth.getSession();
    console.log("[ServerAction] Session after logout:", sessionAfter.session ? 'still exists - forcing cleanup' : 'cleared');
    
    // If session still exists, force clear it
    if (sessionAfter.session) {
      console.log("[ServerAction] Forcing additional session cleanup...");
      await supabase.auth.signOut({ scope: 'global' });
    }
    
    console.log("[ServerAction] Signout successful");
    
    // Force clear all cached paths
    revalidatePath("/", "layout");
    revalidatePath("/dashboard");
    revalidatePath("/login");
    revalidatePath("/edit-profile");
    
    return { success: true };
  } catch (unexpectedError) {
    console.error("[ServerAction] Unexpected error during signout:", unexpectedError);
    return { success: false, error: "Error interno del servidor" };
  }
}

export async function oAuthSignIn(provider: Provider) {
  if (!provider) {
    return redirect("/login");
  }

  const supabase = await createClient();
  const redirectUrl = getURL("/auth/callback");
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: redirectUrl,
    },
  });

  if (error) {
    redirect("/login");
  }

  return redirect(data.url);
}

export async function checkAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  console.log(user);
}

export async function updateUserMetadata(userId: string, username: string) {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.admin.updateUserById(userId, {
    user_metadata: { username },
  });

  if (error) {
    console.error("Error updating user metadata:", error);
  } else {
    console.log("User metadata updated:", data);
  }
}

// metodo q crea un usuario en auth.users (tabla de supabase).
export const createUser = async (user: any) => {
  const supabase = await createClientServiceRole();
  console.log("user:", user);
  debugger;
  const { data: userData, error: userError } =
    await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      user_metadata: {
        display_name: user.username,
      },
      email_confirm: true,
    });

  console.log("userData:", userData);

  // retorna id xq x ahora es lo unico q se necesita
  revalidatePath("/usuarios");
  if (!userData.user) {
    throw new Error("User creation failed: userData.user is null");
  }
  return userData.user.id.toString();
};

// este metodo para poder actualizar el usuario recien creado necesita: toda la data del usuario (user, es un objeto), el id del usuario y el tenant al q pertenece
export const updateUserData = async (
  user: any, // objeto con la data del form
  newUserId: string // tenant al q se va a adjuntar este nuevo usuario
) => {
  try {
    // console.log("updateUserData. debug: ", user, newUserId);
    const currentUser = await getUser();

    // Placeholder: Add your user update logic here using 'user' and 'newUserId' or 'currentUser'
    // Example: Check if currentUser exists and perform update
    if (!currentUser) {
        console.error("Update failed: Could not retrieve current user.");
        return null;
    }
    
    console.log("User data fetched, proceed with update using:", { formData: user, fetchedUser: currentUser, targetUserId: newUserId });
    // ... actual update logic missing ...

    // Return something meaningful, perhaps the result of the update or the fetched user
    return currentUser; // Returning fetched user as placeholder

  } catch (err) {
    console.error("Error updating user:", err);
    return null;
  }
};

