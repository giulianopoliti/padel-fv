"""
🔍 FUZZY SEARCH UTILITY - PYTHON VERSION

Sistema de búsqueda por aproximación con múltiples estrategias.
Equivalente a fuzzy-search.ts para uso en backend Python.

Estrategias implementadas:
1. Normalización de texto (espacios, acentos, case)
2. Búsqueda por palabras individuales
3. Distancia de Levenshtein (similitud de caracteres)
4. Scoring ponderado para rankear resultados

Dependencias:
- Python 3.7+
- unicodedata (built-in)

Uso:
    from fuzzy_search import search_players, fuzzy_search

    players = [
        {'id': '1', 'first_name': 'Juan', 'last_name': 'Pérez', 'dni': '12345678'},
        {'id': '2', 'first_name': 'María', 'last_name': 'García', 'dni': '87654321'}
    ]

    results = search_players('juan perez', players, threshold=0.7)
"""

import unicodedata
from typing import List, Dict, Any, Optional, Tuple


def normalize_string(text: Optional[str]) -> str:
    """
    Normaliza un string para búsqueda:
    - Convierte a minúsculas
    - Elimina espacios extras
    - Remueve acentos y diacríticos
    - Trim de espacios al inicio/final

    Args:
        text: String a normalizar

    Returns:
        String normalizado
    """
    if not text:
        return ''

    # Convertir a string si no lo es
    text = str(text)

    # Minúsculas y trim
    text = text.lower().strip()

    # Múltiples espacios → un espacio
    text = ' '.join(text.split())

    # Remover acentos (NFD = descomponer, luego filtrar diacríticos)
    text = unicodedata.normalize('NFD', text)
    text = ''.join(char for char in text if unicodedata.category(char) != 'Mn')

    return text


def levenshtein_distance(str1: str, str2: str) -> int:
    """
    Calcula la distancia de Levenshtein entre dos strings.
    Representa el número mínimo de ediciones (inserción, eliminación, sustitución)
    necesarias para transformar un string en otro.

    Ejemplo:
        levenshtein_distance("ajuli", "ajulio") = 1 (agregar 'o')
        levenshtein_distance("maria", "mario") = 1 (cambiar 'a' por 'o')

    Args:
        str1: Primer string
        str2: Segundo string

    Returns:
        Número de ediciones necesarias
    """
    len1 = len(str1)
    len2 = len(str2)

    # Crear matriz de distancias
    matrix = [[0] * (len2 + 1) for _ in range(len1 + 1)]

    # Inicializar primera fila y columna
    for i in range(len1 + 1):
        matrix[i][0] = i
    for j in range(len2 + 1):
        matrix[0][j] = j

    # Calcular distancias
    for i in range(1, len1 + 1):
        for j in range(1, len2 + 1):
            cost = 0 if str1[i - 1] == str2[j - 1] else 1
            matrix[i][j] = min(
                matrix[i - 1][j] + 1,      # Eliminación
                matrix[i][j - 1] + 1,      # Inserción
                matrix[i - 1][j - 1] + cost  # Sustitución
            )

    return matrix[len1][len2]


def similarity_score(str1: str, str2: str) -> float:
    """
    Calcula un score de similitud entre dos strings (0-1).
    1.0 = idénticos, 0.0 = totalmente diferentes

    Args:
        str1: Primer string
        str2: Segundo string

    Returns:
        Score entre 0.0 y 1.0
    """
    if str1 == str2:
        return 1.0
    if not str1 or not str2:
        return 0.0

    distance = levenshtein_distance(str1, str2)
    max_length = max(len(str1), len(str2))

    # Normalizar: 1 - (distancia / longitud máxima)
    return 1.0 - (distance / max_length)


def fuzzy_match(
    search_term: str,
    target_text: str,
    threshold: float = 0.75
) -> bool:
    """
    Verifica si un término de búsqueda hace match con un texto objetivo.
    Usa múltiples estrategias de matching.

    Args:
        search_term: Término buscado (puede tener múltiples palabras)
        target_text: Texto donde buscar
        threshold: Umbral de similitud (0-1). Default: 0.75

    Returns:
        True si hay match, False si no
    """
    normalized_search = normalize_string(search_term)
    normalized_target = normalize_string(target_text)

    # Estrategia 1: Match exacto (caso normalizado)
    if normalized_search in normalized_target:
        return True

    # Estrategia 2: Match por palabras individuales
    search_words = [w for w in normalized_search.split() if w]
    target_words = [w for w in normalized_target.split() if w]

    # Todas las palabras de búsqueda deben estar en el target
    all_words_match = all(
        any(
            search_word in target_word or
            similarity_score(search_word, target_word) >= threshold
            for target_word in target_words
        )
        for search_word in search_words
    )

    if all_words_match:
        return True

    # Estrategia 3: Similitud global (para búsquedas cortas con typos)
    if len(normalized_search) > 2 and len(normalized_target) > 2:
        global_similarity = similarity_score(normalized_search, normalized_target)
        if global_similarity >= threshold:
            return True

    return False


class FuzzySearchResult:
    """Resultado de búsqueda con scoring"""

    def __init__(self, item: Dict[str, Any], score: float, matched_fields: List[str]):
        self.item = item
        self.score = score
        self.matched_fields = matched_fields

    def __repr__(self):
        return f"FuzzySearchResult(score={self.score:.2f}, matched_fields={self.matched_fields})"


def fuzzy_search(
    search_term: str,
    items: List[Dict[str, Any]],
    search_fields: List[str],
    threshold: float = 0.75,
    field_weights: Optional[Dict[str, float]] = None,
    limit: Optional[int] = None
) -> List[FuzzySearchResult]:
    """
    🎯 FUNCIÓN PRINCIPAL DE BÚSQUEDA FUZZY

    Busca items en una lista usando múltiples estrategias de matching.
    Retorna resultados ordenados por relevancia (score).

    Args:
        search_term: Término a buscar
        items: Lista de diccionarios donde buscar
        search_fields: Campos donde buscar (ej: ['first_name', 'last_name', 'dni'])
        threshold: Umbral de similitud (0-1). Default: 0.75
        field_weights: Peso de cada campo en el scoring. Default: todos iguales
        limit: Límite de resultados. Default: sin límite

    Returns:
        Lista de FuzzySearchResult ordenados por score

    Example:
        >>> players = [
        ...     {'id': '1', 'first_name': 'Juan', 'last_name': 'Pérez', 'dni': '12345678'},
        ...     {'id': '2', 'first_name': 'María', 'last_name': 'García', 'dni': '87654321'}
        ... ]
        >>> results = fuzzy_search('juan perez', players, ['first_name', 'last_name'])
    """
    # Validación
    if not search_term or not search_term.strip():
        return []

    if field_weights is None:
        field_weights = {}

    normalized_search = normalize_string(search_term)
    results = []

    # Buscar en cada item
    for item in items:
        total_score = 0.0
        match_count = 0
        matched_fields = []

        # Buscar en cada campo configurado
        for field in search_fields:
            if field not in item or not item[field]:
                continue

            field_value = str(item[field])
            normalized_field = normalize_string(field_value)

            # Calcular score para este campo
            field_score = 0.0

            # Match exacto (normalizado)
            if normalized_search in normalized_field:
                field_score = 1.0
            # Match por similitud
            else:
                similarity = similarity_score(normalized_search, normalized_field)
                if similarity >= threshold:
                    field_score = similarity
                # Match por palabras individuales
                else:
                    search_words = [w for w in normalized_search.split() if w]
                    field_words = [w for w in normalized_field.split() if w]

                    word_match_score = 0.0
                    word_match_count = 0

                    for search_word in search_words:
                        best_word_score = 0.0

                        for field_word in field_words:
                            if search_word in field_word:
                                best_word_score = 1.0
                                break
                            word_similarity = similarity_score(search_word, field_word)
                            best_word_score = max(best_word_score, word_similarity)

                        if best_word_score >= threshold:
                            word_match_score += best_word_score
                            word_match_count += 1

                    if word_match_count > 0:
                        field_score = word_match_score / len(search_words)

            # Aplicar peso del campo
            weight = field_weights.get(field, 1.0)

            if field_score > 0:
                total_score += field_score * weight
                match_count += 1
                matched_fields.append(field)

        # Si hubo algún match, agregar a resultados
        if match_count > 0:
            avg_score = total_score / match_count
            results.append(FuzzySearchResult(item, avg_score, matched_fields))

    # Ordenar por score descendente
    results.sort(key=lambda x: x.score, reverse=True)

    # Aplicar límite si está configurado
    if limit and limit > 0:
        return results[:limit]

    return results


def search_players(
    search_term: str,
    players: List[Dict[str, Any]],
    threshold: float = 0.7
) -> List[Dict[str, Any]]:
    """
    🎯 HELPER: Búsqueda fuzzy simplificada para players

    Wrapper especializado para buscar jugadores de padel.

    Args:
        search_term: Término a buscar
        players: Lista de jugadores (dicts con first_name, last_name, dni)
        threshold: Umbral de similitud (default: 0.7)

    Returns:
        Lista de jugadores que hacen match

    Example:
        >>> players = [
        ...     {'id': '1', 'first_name': 'AJuli', 'last_name': 'AJuli', 'dni': '12345678'},
        ... ]
        >>> results = search_players('ajuli ajuli', players)
        >>> print(len(results))  # 1
    """
    # Detectar si la búsqueda es principalmente un DNI
    is_dni_search = search_term.strip()[0].isdigit() if search_term.strip() else False

    if is_dni_search:
        search_fields = ['dni', 'first_name', 'last_name']  # Priorizar DNI
        field_weights = {'dni': 2.0, 'first_name': 1.0, 'last_name': 1.0}
    else:
        search_fields = ['first_name', 'last_name', 'dni']  # Priorizar nombres
        field_weights = {'first_name': 1.5, 'last_name': 1.5, 'dni': 1.0}

    results = fuzzy_search(
        search_term,
        players,
        search_fields,
        threshold=threshold,
        field_weights=field_weights
    )

    # Retornar solo los items (sin el score)
    return [r.item for r in results]


# ============================================================================
# TESTS / EXAMPLES
# ============================================================================

if __name__ == '__main__':
    # Set UTF-8 encoding for Windows console
    import sys
    import io
    if sys.platform == 'win32':
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

    # Ejemplo de uso
    players = [
        {'id': '1', 'first_name': 'AJuli', 'last_name': 'AJuli', 'dni': '12345678'},
        {'id': '2', 'first_name': 'María', 'last_name': 'García', 'dni': '87654321'},
        {'id': '3', 'first_name': 'Juan', 'last_name': 'Pérez', 'dni': '11111111'},
        {'id': '4', 'first_name': 'Julián', 'last_name': 'Gómez', 'dni': '22222222'},
    ]

    print("=" * 60)
    print("🔍 FUZZY SEARCH - EXAMPLES")
    print("=" * 60)

    # Test 1: Búsqueda del problema original
    print("\n📝 Test 1: Búsqueda 'ajuli ajuli' (problema original)")
    results = search_players('ajuli ajuli', players)
    print(f"Resultados encontrados: {len(results)}")
    for player in results:
        print(f"  - {player['first_name']} {player['last_name']} (DNI: {player['dni']})")

    # Test 2: Búsqueda con typo
    print("\n📝 Test 2: Búsqueda con typo 'ajulli'")
    results = search_players('ajulli', players, threshold=0.7)
    print(f"Resultados encontrados: {len(results)}")
    for player in results:
        print(f"  - {player['first_name']} {player['last_name']} (DNI: {player['dni']})")

    # Test 3: Búsqueda por DNI
    print("\n📝 Test 3: Búsqueda por DNI '12345678'")
    results = search_players('12345678', players)
    print(f"Resultados encontrados: {len(results)}")
    for player in results:
        print(f"  - {player['first_name']} {player['last_name']} (DNI: {player['dni']})")

    # Test 4: Búsqueda parcial
    print("\n📝 Test 4: Búsqueda parcial 'jul'")
    results = search_players('jul', players, threshold=0.6)
    print(f"Resultados encontrados: {len(results)}")
    for player in results:
        print(f"  - {player['first_name']} {player['last_name']} (DNI: {player['dni']})")

    # Test 5: Búsqueda con acentos
    print("\n📝 Test 5: Búsqueda 'maria garcia' (sin acentos)")
    results = search_players('maria garcia', players)
    print(f"Resultados encontrados: {len(results)}")
    for player in results:
        print(f"  - {player['first_name']} {player['last_name']} (DNI: {player['dni']})")

    print("\n" + "=" * 60)
    print("✅ Tests completados")
    print("=" * 60)
