"""
🚀 EJEMPLO DE INTEGRACIÓN BACKEND - FUZZY SEARCH

Ejemplos de cómo integrar fuzzy_search.py en diferentes frameworks Python.

Incluye:
- FastAPI (moderno, async, recomendado)
- Flask (clásico, síncrono)
- Django REST Framework (opcional)
"""

# ============================================================================
# EJEMPLO 1: FASTAPI (Recomendado)
# ============================================================================

"""
Instalación:
    pip install fastapi uvicorn sqlalchemy

Ejecutar:
    uvicorn python_backend_example:app --reload
"""

from typing import List, Optional
from fastapi import FastAPI, Query, HTTPException
from pydantic import BaseModel
from fuzzy_search import search_players, fuzzy_search

# Crear app FastAPI
app = FastAPI(title="Padel Players Search API")


# Modelos Pydantic
class Player(BaseModel):
    id: str
    first_name: str
    last_name: str
    dni: Optional[str] = None
    score: Optional[int] = None


class SearchRequest(BaseModel):
    search_term: str
    threshold: float = 0.7


class SearchResponse(BaseModel):
    results: List[Player]
    count: int
    search_term: str


# ============================================================================
# ENDPOINTS
# ============================================================================

@app.get("/")
def root():
    """Health check"""
    return {"status": "ok", "message": "Padel Players Search API"}


@app.get("/api/players/search", response_model=SearchResponse)
async def search_players_endpoint(
    q: str = Query(..., min_length=3, description="Término de búsqueda"),
    threshold: float = Query(0.7, ge=0.0, le=1.0, description="Umbral de similitud")
):
    """
    🔍 Búsqueda fuzzy de jugadores

    Ejemplo:
        GET /api/players/search?q=ajuli%20ajuli&threshold=0.7

    Args:
        q: Término de búsqueda (mínimo 3 caracteres)
        threshold: Umbral de similitud (0.0-1.0)

    Returns:
        Lista de jugadores que hacen match
    """
    # Simular obtención de jugadores desde DB
    # En producción: players = db.query(Player).all()
    players = get_players_from_db()

    # Convertir a dicts para fuzzy_search
    players_dict = [
        {
            'id': p.id,
            'first_name': p.first_name,
            'last_name': p.last_name,
            'dni': p.dni,
            'score': p.score
        }
        for p in players
    ]

    # Ejecutar búsqueda fuzzy
    results = search_players(q, players_dict, threshold=threshold)

    return SearchResponse(
        results=[Player(**r) for r in results],
        count=len(results),
        search_term=q
    )


@app.post("/api/players/search", response_model=SearchResponse)
async def search_players_post(request: SearchRequest):
    """
    🔍 Búsqueda fuzzy de jugadores (POST)

    Ejemplo:
        POST /api/players/search
        {
            "search_term": "ajuli ajuli",
            "threshold": 0.7
        }
    """
    players = get_players_from_db()

    players_dict = [
        {
            'id': p.id,
            'first_name': p.first_name,
            'last_name': p.last_name,
            'dni': p.dni,
            'score': p.score
        }
        for p in players
    ]

    results = search_players(
        request.search_term,
        players_dict,
        threshold=request.threshold
    )

    return SearchResponse(
        results=[Player(**r) for r in results],
        count=len(results),
        search_term=request.search_term
    )


@app.get("/api/players/search/advanced")
async def search_players_advanced(
    q: str = Query(..., min_length=3),
    fields: List[str] = Query(['first_name', 'last_name', 'dni']),
    threshold: float = Query(0.7, ge=0.0, le=1.0),
    limit: Optional[int] = Query(None, ge=1, le=100)
):
    """
    🔍 Búsqueda fuzzy avanzada con configuración personalizada

    Ejemplo:
        GET /api/players/search/advanced?q=ajuli&fields=first_name&fields=dni&threshold=0.8&limit=10
    """
    players = get_players_from_db()

    players_dict = [
        {
            'id': p.id,
            'first_name': p.first_name,
            'last_name': p.last_name,
            'dni': p.dni,
            'score': p.score
        }
        for p in players
    ]

    # Usar fuzzy_search con configuración personalizada
    results = fuzzy_search(
        search_term=q,
        items=players_dict,
        search_fields=fields,
        threshold=threshold,
        limit=limit
    )

    return {
        'results': [
            {
                'player': r.item,
                'score': r.score,
                'matched_fields': r.matched_fields
            }
            for r in results
        ],
        'count': len(results),
        'search_term': q,
        'config': {
            'fields': fields,
            'threshold': threshold,
            'limit': limit
        }
    }


# ============================================================================
# HELPER: Simular DB (reemplazar con tu DB real)
# ============================================================================

def get_players_from_db() -> List[Player]:
    """
    Simula obtención de jugadores desde base de datos.

    En producción, reemplazar con:
        session = SessionLocal()
        players = session.query(Player).all()
        session.close()
        return players
    """
    return [
        Player(id='1', first_name='AJuli', last_name='AJuli', dni='12345678', score=100),
        Player(id='2', first_name='María', last_name='García', dni='87654321', score=95),
        Player(id='3', first_name='Juan', last_name='Pérez', dni='11111111', score=88),
        Player(id='4', first_name='Julián', last_name='Gómez', dni='22222222', score=92),
        Player(id='5', first_name='José', last_name='Rodríguez', dni='33333333', score=85),
    ]


# ============================================================================
# EJEMPLO 2: FLASK (Alternativa clásica)
# ============================================================================

"""
from flask import Flask, request, jsonify
from fuzzy_search import search_players

flask_app = Flask(__name__)

@flask_app.route('/api/players/search', methods=['GET'])
def flask_search_players():
    search_term = request.args.get('q', '')
    threshold = float(request.args.get('threshold', 0.7))

    if len(search_term) < 3:
        return jsonify({'error': 'Mínimo 3 caracteres'}), 400

    # Obtener players de DB
    players = get_players_from_db()
    players_dict = [p.dict() for p in players]

    # Búsqueda fuzzy
    results = search_players(search_term, players_dict, threshold)

    return jsonify({
        'results': results,
        'count': len(results),
        'search_term': search_term
    })

if __name__ == '__main__':
    flask_app.run(debug=True)
"""


# ============================================================================
# EJEMPLO 3: INTEGRACIÓN CON SQLALCHEMY
# ============================================================================

"""
from sqlalchemy import create_engine, Column, String, Integer
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Session

Base = declarative_base()

class PlayerModel(Base):
    __tablename__ = 'players'

    id = Column(String, primary_key=True)
    first_name = Column(String)
    last_name = Column(String)
    dni = Column(String)
    score = Column(Integer)

def search_players_in_db(search_term: str, threshold: float = 0.7):
    # Obtener TODOS los players de DB
    engine = create_engine('postgresql://user:pass@localhost/db')
    session = Session(engine)

    all_players = session.query(PlayerModel).all()

    # Convertir a dicts
    players_dict = [
        {
            'id': p.id,
            'first_name': p.first_name,
            'last_name': p.last_name,
            'dni': p.dni,
            'score': p.score
        }
        for p in all_players
    ]

    # Búsqueda fuzzy en memoria
    results = search_players(search_term, players_dict, threshold)

    session.close()
    return results
"""


# ============================================================================
# EJEMPLO 4: OPTIMIZACIÓN CON POSTGRESQL pg_trgm
# ============================================================================

"""
Para datasets muy grandes (>10,000 jugadores), usar pg_trgm:

-- Habilitar extensión
CREATE EXTENSION pg_trgm;

-- Crear índice trigram
CREATE INDEX players_name_trgm_idx ON players
USING gin ((first_name || ' ' || last_name) gin_trgm_ops);

-- Query SQL con similitud
SELECT
    id,
    first_name,
    last_name,
    similarity(first_name || ' ' || last_name, 'ajuli ajuli') as score
FROM players
WHERE
    first_name || ' ' || last_name % 'ajuli ajuli'  -- % = operador de similitud
ORDER BY score DESC
LIMIT 10;

# Python con SQLAlchemy
from sqlalchemy import func, text

def search_with_pg_trgm(search_term: str, session: Session):
    full_name = func.concat(PlayerModel.first_name, ' ', PlayerModel.last_name)

    results = session.query(
        PlayerModel,
        func.similarity(full_name, search_term).label('score')
    ).filter(
        full_name.op('%')(search_term)  # Operador % de pg_trgm
    ).order_by(
        text('score DESC')
    ).limit(10).all()

    return [
        {
            'player': r.PlayerModel,
            'score': r.score
        }
        for r in results
    ]
"""


# ============================================================================
# EJEMPLO 5: CACHÉ CON REDIS
# ============================================================================

"""
from redis import Redis
import json

redis_client = Redis(host='localhost', port=6379, db=0)

def search_players_with_cache(search_term: str, threshold: float = 0.7):
    # Crear cache key
    cache_key = f"search:{search_term}:{threshold}"

    # Intentar obtener de caché
    cached = redis_client.get(cache_key)
    if cached:
        return json.loads(cached)

    # Si no está en caché, buscar
    players = get_players_from_db()
    players_dict = [p.dict() for p in players]
    results = search_players(search_term, players_dict, threshold)

    # Guardar en caché (TTL 5 minutos)
    redis_client.setex(
        cache_key,
        300,  # 5 minutos
        json.dumps(results)
    )

    return results
"""


# ============================================================================
# TESTING
# ============================================================================

if __name__ == '__main__':
    print("=" * 60)
    print("🧪 TESTING FASTAPI ENDPOINTS")
    print("=" * 60)

    # Test básico
    players = get_players_from_db()
    print(f"\n📊 Total players: {len(players)}")

    # Test search
    test_terms = [
        "ajuli ajuli",
        "ajulli",
        "maria garcia",
        "12345",
        "jul"
    ]

    for term in test_terms:
        players_dict = [
            {
                'id': p.id,
                'first_name': p.first_name,
                'last_name': p.last_name,
                'dni': p.dni,
                'score': p.score
            }
            for p in players
        ]

        results = search_players(term, players_dict, threshold=0.7)
        print(f"\n🔍 Search '{term}': {len(results)} resultados")
        for r in results[:3]:  # Mostrar top 3
            print(f"  - {r['first_name']} {r['last_name']} (DNI: {r['dni']})")

    print("\n" + "=" * 60)
    print("✅ Para ejecutar el servidor:")
    print("   uvicorn python_backend_example:app --reload")
    print("=" * 60)
