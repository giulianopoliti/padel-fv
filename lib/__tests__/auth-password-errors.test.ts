import { getPasswordErrorMessage } from "@/lib/auth-password-errors"

describe("getPasswordErrorMessage", () => {
  it("explains when the new password matches the previous password", () => {
    expect(
      getPasswordErrorMessage(
        { code: "same_password", message: "New password should be different from the old password." },
        "recovery",
      ),
    ).toBe("La nueva contraseña debe ser diferente de la contraseña anterior.")
  })

  it("explains when the current password is incorrect", () => {
    expect(
      getPasswordErrorMessage({ code: "invalid_credentials", message: "Invalid login credentials" }, "current-password"),
    ).toBe("La contraseña actual es incorrecta.")
  })

  it("explains an expired recovery session", () => {
    expect(
      getPasswordErrorMessage({ code: "session_expired", message: "Session expired" }, "recovery"),
    ).toBe("La sesión de recuperación venció. Solicita un enlace nuevo.")
  })

  it("does not expose unknown Supabase errors", () => {
    expect(
      getPasswordErrorMessage({ code: "unexpected_failure", message: "internal provider detail" }, "change"),
    ).toBe("No se pudo cambiar la contraseña. Intenta nuevamente.")
  })
})
