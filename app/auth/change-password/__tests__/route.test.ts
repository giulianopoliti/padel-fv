import { POST } from "@/app/auth/change-password/route"
import { createClient } from "@/utils/supabase/server"

jest.mock("@/utils/supabase/server", () => ({
  createClient: jest.fn(),
}))

const mockedCreateClient = createClient as jest.MockedFunction<typeof createClient>

const createRequest = (body: Record<string, string>) =>
  new Request("http://localhost/auth/change-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

describe("POST /auth/change-password", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("rejects a repeated password before calling Supabase", async () => {
    const response = await POST(createRequest({
      confirmPassword: "password123",
      currentPassword: "password123",
      newPassword: "password123",
    }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "La nueva contraseña debe ser diferente de la contraseña anterior.",
    })
    expect(mockedCreateClient).not.toHaveBeenCalled()
  })

  it("does not update the password when the current password is incorrect", async () => {
    const updateUser = jest.fn()
    mockedCreateClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { email: "user@example.com", id: "user-id" } },
          error: null,
        }),
        signInWithPassword: jest.fn().mockResolvedValue({
          error: { code: "invalid_credentials", message: "Invalid login credentials", status: 400 },
        }),
        updateUser,
      },
    } as never)

    const response = await POST(createRequest({
      confirmPassword: "new-password-123",
      currentPassword: "wrong-password",
      newPassword: "new-password-123",
    }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "La contraseña actual es incorrecta." })
    expect(updateUser).not.toHaveBeenCalled()
  })

  it("updates the password after verifying the current password", async () => {
    const updateUser = jest.fn().mockResolvedValue({ error: null })
    mockedCreateClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { email: "user@example.com", id: "user-id" } },
          error: null,
        }),
        signInWithPassword: jest.fn().mockResolvedValue({ error: null }),
        updateUser,
      },
    } as never)

    const response = await POST(createRequest({
      confirmPassword: "new-password-123",
      currentPassword: "current-password",
      newPassword: "new-password-123",
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true })
    expect(updateUser).toHaveBeenCalledWith({ password: "new-password-123" })
  })
})
