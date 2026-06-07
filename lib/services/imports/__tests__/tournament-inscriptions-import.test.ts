import * as XLSX from "xlsx"

import {
  buildAlreadyInscribedMessage,
  parseWorkbookBuffer,
  splitFullName,
} from "@/lib/services/imports/tournament-inscriptions-import"

const buildWorkbookBuffer = (sheetName: string, rows: unknown[][]): Buffer => {
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.aoa_to_sheet(rows)
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer
}

describe("tournament inscriptions import", () => {
  it("parses the selected sheet using the four-column inscription format", () => {
    const buffer = buildWorkbookBuffer("C6", [
      ["Nombre y Apellido", "DNI", "Nombre y Apellido", "DNI"],
      ["Sebastian Rosa", "24.940.379", "Franco Ferrero", ""],
    ])

    const parsed = parseWorkbookBuffer(buffer, { sheetName: "C6", tournamentGender: "MALE" })

    expect(parsed.selectedSheetName).toBe("C6")
    expect(parsed.rows).toHaveLength(1)
    expect(parsed.rows[0].rowType).toBe("couple")
    expect(parsed.rows[0].player1).toMatchObject({
      firstName: "Sebastian",
      lastName: "Rosa",
      dni: "24940379",
      gender: "MALE",
    })
    expect(parsed.rows[0].player2).toMatchObject({
      firstName: "Franco",
      lastName: "Ferrero",
      dni: null,
      gender: "MALE",
    })
  })

  it("treats placeholder second players as individual inscriptions", () => {
    const buffer = buildWorkbookBuffer("M14", [
      ["Nombre y Apellido", "DNI", "Nombre y Apellido", "DNI"],
      ["Javier Lasteche", "22001691", "xxxxxxxxxx", ""],
    ])

    const parsed = parseWorkbookBuffer(buffer, { sheetName: "M14", tournamentGender: "MIXED" })

    expect(parsed.rows).toHaveLength(1)
    expect(parsed.rows[0].rowType).toBe("individual")
    expect(parsed.rows[0].player1?.fullName).toBe("Javier Lasteche")
    expect(parsed.rows[0].player2).toBeNull()
  })

  it("allows a player with only first name and imports without last name", () => {
    expect(splitFullName("Nicolas")).toEqual({ firstName: "Nicolas", lastName: "" })

    const buffer = buildWorkbookBuffer("C6", [
      ["Nombre y Apellido", "DNI", "Nombre y Apellido", "DNI"],
      ["Nicolas", "", "", ""],
    ])

    const parsed = parseWorkbookBuffer(buffer, { sheetName: "C6", tournamentGender: "MALE" })

    expect(parsed.rows).toHaveLength(1)
    expect(parsed.rows[0].rowType).toBe("individual")
    expect(parsed.rows[0].player1).toMatchObject({
      firstName: "Nicolas",
      lastName: "",
    })
    expect(parsed.rows[0].player1?.warnings).toContain("Se importara sin apellido.")
  })

  it("formats already-inscribed rows as skippable warnings", () => {
    expect(buildAlreadyInscribedMessage(["Javier Lasteche"])).toBe(
      "Javier Lasteche ya estaba inscripto. Fila omitida.",
    )
    expect(buildAlreadyInscribedMessage(["Javier Lasteche", "Ana Perez"])).toBe(
      "Javier Lasteche / Ana Perez ya estaban inscriptos. Fila omitida.",
    )
  })
})
