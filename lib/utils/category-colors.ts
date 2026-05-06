/**
 * Colores para las categorias de jugadores
 * 
 * Categorias de produccion (4ta a 9na):
 * 4ta - Rosa/Rojo
 * 5ta - Naranja
 * 6ta - Amarillo
 * 7ma - Verde
 * 8va - Celeste/Cyan
 * 9na - Azul
 */

export type CategoryColorVariant = 'badge' | 'text' | 'bg'

interface CategoryColors {
  badge: string      // Para usar con Badge (incluye bg, text, border)
  text: string       // Solo color de texto
  bg: string         // Solo color de fondo
  gradient: string   // Gradiente para efectos especiales
}

// Colores base para cada categoria
const colors4ta: CategoryColors = {
  badge: 'bg-pink-100 text-pink-700 border-pink-300',
  text: 'text-pink-600',
  bg: 'bg-pink-500',
  gradient: 'bg-gradient-to-r from-pink-400 to-pink-600'
}

const colors5ta: CategoryColors = {
  badge: 'bg-orange-100 text-orange-700 border-orange-300',
  text: 'text-orange-600',
  bg: 'bg-orange-500',
  gradient: 'bg-gradient-to-r from-orange-400 to-orange-600'
}

const colors6ta: CategoryColors = {
  badge: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  text: 'text-yellow-600',
  bg: 'bg-yellow-500',
  gradient: 'bg-gradient-to-r from-yellow-400 to-yellow-600'
}

const colors7ma: CategoryColors = {
  badge: 'bg-green-100 text-green-700 border-green-300',
  text: 'text-green-600',
  bg: 'bg-green-500',
  gradient: 'bg-gradient-to-r from-green-400 to-green-600'
}

const colors8va: CategoryColors = {
  badge: 'bg-cyan-100 text-cyan-700 border-cyan-300',
  text: 'text-cyan-600',
  bg: 'bg-cyan-500',
  gradient: 'bg-gradient-to-r from-cyan-400 to-cyan-600'
}

const colors9na: CategoryColors = {
  badge: 'bg-blue-100 text-blue-700 border-blue-300',
  text: 'text-blue-600',
  bg: 'bg-blue-500',
  gradient: 'bg-gradient-to-r from-blue-400 to-blue-600'
}

const categoryColorMap: Record<string, CategoryColors> = {
  // 4ta - Rosa/Rojo
  '4ta': colors4ta,
  '4ª': colors4ta,
  '4a': colors4ta,
  
  // 5ta - Naranja
  '5ta': colors5ta,
  '5ª': colors5ta,
  '5a': colors5ta,
  
  // 6ta - Amarillo
  '6ta': colors6ta,
  '6ª': colors6ta,
  '6a': colors6ta,
  
  // 7ma - Verde
  '7ma': colors7ma,
  '7ª': colors7ma,
  '7a': colors7ma,
  
  // 8va - Celeste/Cyan
  '8va': colors8va,
  '8ª': colors8va,
  '8a': colors8va,
  
  // 9na - Azul
  '9na': colors9na,
  '9ª': colors9na,
  '9a': colors9na,
}

const defaultColors: CategoryColors = {
  badge: 'bg-gray-100 text-gray-700 border-gray-300',
  text: 'text-gray-600',
  bg: 'bg-gray-500',
  gradient: 'bg-gradient-to-r from-gray-400 to-gray-600'
}

/**
 * Obtiene las clases CSS para el color de una categoria
 * @param categoryName - Nombre de la categoria (ej: "4ta", "5ta", "7ma", etc.)
 * @param variant - Tipo de color: 'badge' (default), 'text', 'bg', 'gradient'
 * @returns Clases CSS para el color
 */
export function getCategoryColor(categoryName: string | null | undefined, variant: keyof CategoryColors = 'badge'): string {
  if (!categoryName) return defaultColors[variant]
  
  const colors = categoryColorMap[categoryName] || defaultColors
  return colors[variant]
}

/**
 * Obtiene todas las variantes de color para una categoria
 * @param categoryName - Nombre de la categoria
 * @returns Objeto con todas las variantes de color
 */
export function getCategoryColors(categoryName: string | null | undefined): CategoryColors {
  if (!categoryName) return defaultColors
  return categoryColorMap[categoryName] || defaultColors
}

/**
 * Lista de todas las categorias con sus colores (para leyendas, etc.)
 */
export const allCategoryColors = [
  { name: '4ta', label: '4ta', ...colors4ta },
  { name: '5ta', label: '5ta', ...colors5ta },
  { name: '6ta', label: '6ta', ...colors6ta },
  { name: '7ma', label: '7ma', ...colors7ma },
  { name: '8va', label: '8va', ...colors8va },
  { name: '9na', label: '9na', ...colors9na },
]

