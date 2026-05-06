import { parsePhoneNumberFromString, isValidPhoneNumber } from 'libphonenumber-js'

export type PhoneValidationResult = {
  isValid: boolean
  e164?: string
  country?: string
  national?: string
  error?: string
}

export const validateAndFormatPhone = (
  rawInput: string,
  defaultCountry: string = 'AR'
): PhoneValidationResult => {
  if (!rawInput || rawInput.trim() === '') {
    return { isValid: false, error: 'El teléfono es requerido.' }
  }

  const input = rawInput.trim()

  const valid = input.startsWith('+')
    ? isValidPhoneNumber(input)
    : isValidPhoneNumber(input, defaultCountry as any)

  if (!valid) {
    return {
      isValid: false,
      error:
        'Teléfono inválido. Usa formato internacional (+54 9 ...) o un número local válido.'
    }
  }

  const parsed = input.startsWith('+')
    ? parsePhoneNumberFromString(input)
    : parsePhoneNumberFromString(input, defaultCountry as any)

  if (!parsed || !parsed.isValid()) {
    return {
      isValid: false,
      error:
        'Teléfono inválido. Usa formato internacional (+54 9 ...) o un número local válido.'
    }
  }

  return {
    isValid: true,
    e164: parsed.number,
    country: parsed.country,
    national: parsed.nationalNumber
  }
}


