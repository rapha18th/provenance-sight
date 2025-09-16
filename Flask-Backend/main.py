import os, json, logging, warnings, time, certifi, pymysql, requests
from contextlib import contextmanager
from datetime import date
from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import date, datetime
# ---- Optional Google GenAI (Gemini) ----
from google import genai
from google.genai import types

from pymysql.err import OperationalError
import threading
warnings.filterwarnings("ignore")

# ── NEW: lightweight event inference from sentences ───────────────────────────
import re
from typing import List, Dict, Any, Optional
# ───────────────────────────────────────────────────────────────────────────────
# CONFIG
# ───────────────────────────────────────────────────────────────────────────────
DB_NAME        = os.getenv("TIDB_DB")
TIDB_HOST      = os.getenv("TIDB_HOST")
TIDB_PORT      = int(os.getenv("TIDB_PORT"))
TIDB_USER      = os.getenv("TIDB_USER")
TIDB_PASS      = os.getenv("TIDB_PASS")

VEC_DIM        = int(os.getenv("VEC_DIM", "1536"))
EMBED_MODEL    = os.getenv("EMBED_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
USE_GPU        = os.getenv("USE_GPU", "0") == "1"  # Spaces are usually CPU; works either way

# Policy windows (server is single source of truth for the client)
POLICY_WINDOWS = [
    {
        "code": "NAZI_ERA",
        "label": "Washington Conference Principles (1933–1945)",
        "from": "1933-01-01",
        "to":   "1945-12-31",
        "ref":  "https://www.state.gov/washington-conference-principles-on-nazi-confiscated-art"
    },
    {
        "code": "UNESCO_1970",
        "label": "UNESCO 1970 Convention",
        "from": "1970-11-14",
        "to":   None,
        "ref":  "https://www.unesco.org/en/legal-affairs/convention-means-prohibiting-and-preventing-illicit-import-export-and-transfer-ownership-cultural"
    }
]

# ───────────────────────────────────────────────────────────────────────────────
# APP + LOGGING
# ───────────────────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
log = logging.getLogger("provenance-api")

app = Flask(__name__)
CORS(app)

# ───────────────────────────────────────────────────────────────────────────────
# DB CONNECTION (refactored for better connection management)
# ───────────────────────────────────────────────────────────────────────────────
_connection_lock = threading.Lock()

def _create_connection():
    """Create a new database connection with optimized settings"""
    return pymysql.connect(
        host=TIDB_HOST,
        port=TIDB_PORT,
        user=TIDB_USER,
        password=TIDB_PASS,
        database=DB_NAME,
        ssl={"ca": certifi.where()},
        ssl_verify_cert=True,
        ssl_verify_identity=True,
        autocommit=True,
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
        connect_timeout=10,
        read_timeout=60,  # Increased for vector operations
        write_timeout=30,
        # TiDB-specific optimizations:
        init_command="SET SESSION sql_mode='STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO'",
        client_flag=pymysql.constants.CLIENT.MULTI_STATEMENTS,
    )

@contextmanager
def cursor():
    """Create a fresh connection for each request context with retry logic"""
    conn = None
    max_retries = 3
    
    for attempt in range(max_retries):
        try:
            conn = _create_connection()
            with conn.cursor() as cur:
                yield cur
            break
        except (OperationalError, pymysql.err.InternalError) as e:
            if conn:
                try:
                    conn.close()
                except Exception:
                    pass
                conn = None
            
            if attempt == max_retries - 1:
                log.error(f"Database connection failed after {max_retries} attempts: {e}")
                raise
            else:
                log.warning(f"Database connection failed (attempt {attempt + 1}): {e}")
                time.sleep(0.5 * (attempt + 1))  # Exponential backoff
        except Exception as e:
            if conn:
                try:
                    conn.close()
                except Exception:
                    pass
            log.error(f"Database connection failed: {e}")
            raise
        finally:
            if conn:
                try:
                    conn.close()
                except Exception:
                    pass

def with_db_retry(func):
    """Decorator to retry database operations on connection failures"""
    import functools
    @functools.wraps(func)  # This preserves the original function's metadata
    def wrapper(*args, **kwargs):
        max_retries = 3
        for attempt in range(max_retries):
            try:
                return func(*args, **kwargs)
            except (OperationalError, pymysql.err.InternalError) as e:
                if attempt == max_retries - 1:
                    log.error(f"Database operation failed after {max_retries} attempts: {e}")
                    raise
                log.warning(f"Database operation failed (attempt {attempt + 1}): {e}")
                time.sleep(0.5 * (attempt + 1))
    return wrapper

# ───────────────────────────────────────────────────────────────────────────────
# ERROR HANDLERS
# ───────────────────────────────────────────────────────────────────────────────
@app.errorhandler(OperationalError)
def handle_db_error(e):
    log.error(f"Database error: {e}")
    return jsonify({
        "ok": False, 
        "error": "database_unavailable",
        "message": "Database connection issue. Please try again."
    }), 503

@app.errorhandler(pymysql.err.InternalError)
def handle_internal_error(e):
    log.error(f"Database internal error: {e}")
    return jsonify({
        "ok": False,
        "error": "database_error", 
        "message": "Database operation failed. Please try again."
    }), 500

# ───────────────────────────────────────────────────────────────────────────────
# EMBEDDINGS (lazy-load; same model as ingest; pad to 1536)
# ───────────────────────────────────────────────────────────────────────────────
_MODEL = None
_DEVICE_INFO = "cpu"

def _pad(vec, dim=VEC_DIM):
    return vec[:dim] + [0.0] * max(0, dim - len(vec))

def _load_model():
    global _MODEL, _DEVICE_INFO
    if _MODEL is not None:
        return _MODEL
    if USE_GPU:
        try:
            import torch
            if torch.cuda.is_available():
                _DEVICE_INFO = "cuda"
        except Exception:
            _DEVICE_INFO = "cpu"
    from sentence_transformers import SentenceTransformer
    _MODEL = SentenceTransformer(EMBED_MODEL, device=_DEVICE_INFO)
    log.info(f"Loaded embedding model on '{_DEVICE_INFO}': {EMBED_MODEL}")
    return _MODEL


def embed_text_to_vec1536(text: str):
    model = _load_model()
    # Use Torch tensors to avoid NumPy code path entirely
    import torch
    t = model.encode([text], batch_size=1, show_progress_bar=False, convert_to_tensor=True)
    if isinstance(t, torch.Tensor):
        vec = t[0].detach().cpu().tolist()
    else:
        # very defensive fallback
        vec = list(t[0])
    return _pad(vec, VEC_DIM)


def to_iso(d):
    """Return YYYY-MM-DD for date/datetime/str; None for empty."""
    if d is None:
        return None
    if isinstance(d, (date, datetime)):
        return d.isoformat()[:10]
    if isinstance(d, str):
        return d[:10] if d else None
    # fallback
    try:
        return str(d)[:10]
    except Exception:
        return None
# ───────────────────────────────────────────────────────────────────────────────
# GEMINI (explanations / descriptions)
# ───────────────────────────────────────────────────────────────────────────────
GEMINI_KEY = os.environ.get("Gemini")
_gclient = None

def _gemini():
    global _gclient
    if _gclient is not None:
        return _gclient
    if not GEMINI_KEY:
        return None
    try:
        _gclient = genai.Client(api_key=GEMINI_KEY)
        log.info("Gemini client initialized.")
        return _gclient
    except Exception as e:
        log.warning(f"Gemini init failed: {e}")
        return None

EXPLAIN_MODEL = "gemini-2.0-flash"

def gemini_explain(prompt: str, sys: str = None, model: str = EXPLAIN_MODEL) -> str:
    g = _gemini()
    if g is None:
        # Graceful fallback so the API still works without a key
        return "(Gemini not configured) " + prompt[:180]
    # chat-style to mirror your original pattern
    chat = g.chats.create(model=model)
    # Add a light system preamble for style/constraints
    if sys:
        chat.send_message(f"[SYSTEM]\n{sys}")
    resp = chat.send_message(prompt)
    return getattr(resp, "text", "").strip() or ""

# ───────────────────────────────────────────────────────────────────────────────
# UTIL: Build risk scores, graph & timeline from events (+ risk overlays)
# ───────────────────────────────────────────────────────────────────────────────
# 
# Targets:
#   raw 100  -> ~55
#   raw 200  -> ~80
#   raw 2000 -> ~99 (slow approach to 99 beyond this)
# BLOCK 1 — Helpers (drop-in)
# - Piecewise normalize_risk() curve
# - _to_float() coercion
# - _apply_normalized_risk_inplace(): overwrites 'risk_score' and keeps 'risk_score_raw'

import math
from decimal import Decimal

def _to_float(x):
    if x is None: return None
    if isinstance(x, (int, float)): return float(x)
    if isinstance(x, Decimal): return float(x)
    if isinstance(x, str):
        try: return float(x.strip().replace("%",""))
        except Exception: return None
    try: return float(x)
    except Exception: return None

def _piecewise_0_99_from_percent(pct: float) -> float:
    """Piecewise curve on a 0–99 scale using 'percent' inputs (100, 200, ...)."""
    x = max(float(pct), 0.0)
    if x <= 100.0:
        out = 55.0 * ((x / 100.0) ** 0.7)              # ~55 at 100
    elif x <= 200.0:
        out = 55.0 + 25.0 * (((x - 100.0) / 100.0) ** 0.8)  # 55→80 between 100–200
    else:
        k = math.log(100.0) / 1800.0                   # ~98.8 at 2000
        out = 99.0 - 19.0 * math.exp(-k * (x - 200.0))
    return max(0.0, min(out, 99.0))

def normalize_risk(score_ratio: float) -> float:
    """
    INPUT:  raw ratio (1.0=100%, 2.0=200%, 6.0=600%)
    OUTPUT: normalized ratio on 0–1 scale (e.g., 0.8 for 80%)
    """
    r = _to_float(score_ratio)
    if r is None: return None
    pct_in = r * 100.0                    # convert to percent domain for mapping
    pct_out = _piecewise_0_99_from_percent(pct_in)
    return round(pct_out / 100.0, 6)      # send back as 0–1 for the UI


def _apply_normalized_risk_inplace(row: dict):
    if not isinstance(row, dict):
        return
    raw_ratio = _to_float(row.get("risk_score"))
    if raw_ratio is None:
        return
    norm_ratio = normalize_risk(raw_ratio)             # 0–1
    norm_0_99  = None if norm_ratio is None else round(norm_ratio * 100.0, 2)

    row["risk_score_raw"]       = raw_ratio           # raw ratio (e.g., 2.0)
    row["risk_score_norm_0_99"] = norm_0_99           # 0–99 reference (e.g., 80.0)
    row["risk_score"]           = norm_ratio          # **what client already uses** (0–1)
    row["risk_score_normalized"]= norm_ratio          # alias if client checks this too


EVENT_VERBS = {
    "sold": "SOLD",
    "purchased": "PURCHASED",
    "bought": "PURCHASED",
    "acquired": "ACQUIRED",
    "donated": "DONATED",
    "gifted": "DONATED",
    "bequeathed": "BEQUEATHED",
    "consigned": "CONSIGNED",
    "exhibited": "EXHIBITED",
    "exported": "EXPORTED",
    "imported": "IMPORTED",
}

YEAR_RE = re.compile(r"\b(1[6-9]\d{2}|20\d{2})\b")  # 1600–2099

def _clean(s: Optional[str]) -> Optional[str]:
    if not s: return None
    s = re.sub(r"\s+", " ", s).strip(" ,.;:-–—")
    return s or None

def _infer_from_sentence(txt: str) -> Optional[Dict[str, Any]]:
    """
    Very pragmatic patterns that cover most catalogue phrasing:
      - 'sold to X, <place>, 2000'
      - 'sold to X, by 2000'
      - 'purchased from Y in 1965'
      - 'donated by X, <place>, 1971'
    Returns a dict compatible with provenance_events rows.
    """
    if not txt: 
        return None
    low = txt.lower()

    # find verb
    verb = next((EVENT_VERBS[v] for v in EVENT_VERBS if v in low), None)
    if not verb:
        return None

    # pull a year (prefers the last year in the string)
    years = YEAR_RE.findall(txt)
    year = years[-1] if years else None

    actor = None
    place = None

    # Common pattern: 'sold to X, place, 2000'
    m = re.search(r"\b(sold|purchased|bought|acquired|donated|gifted|bequeathed|consigned)\s+(to|by|from)\s+(.*)$", low)
    if m:
        # Take the fragment after 'to/by/from'
        frag = txt[m.end(2)+1:].strip()
        # Trim trailing year or 'by 2000'
        frag = re.sub(r"(,\s*)?(by\s*)?\b(1[6-9]\d{2}|20\d{2})\b.*$", "", frag, flags=re.IGNORECASE).strip(" ,.;")
        # Split on commas: first token is actor; the rest (if any) is place
        parts = [p.strip() for p in re.split(r",(?![^()]*\))", frag) if p.strip()]
        if parts:
            actor = parts[0]
            if len(parts) > 1:
                place = ", ".join(parts[1:])

    # Fallback simple 'sold to X' without commas
    if not actor:
        m2 = re.search(r"\bsold\s+to\s+([^,.;]+)", low)
        if m2:
            actor = _clean(txt[m2.start(1):m2.end(1)])

    return {
        "event_type": verb,
        "date_from": f"{year}-01-01" if year else None,
        "date_to": None,
        "place": _clean(place),
        "actor": _clean(actor),
        "method": None,
        "source_ref": "inferred:sentence"
    }

def infer_events_from_sentences(sentences: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for s in sentences:
        ev = _infer_from_sentence(s.get("sentence", ""))
        if ev and (ev.get("actor") or ev.get("place")):
            ev["seq"] = s.get("seq")
            out.append(ev)
    # Deduplicate (actor+place+event_type+date_from)
    seen = set()
    uniq = []
    for e in out:
        key = (e.get("actor"), e.get("place"), e.get("event_type"), e.get("date_from"))
        if key in seen: 
            continue
        seen.add(key)
        uniq.append(e)
    return uniq

# ── OPTIONAL: simple geocode cache for map pins ───────────────────────────────
def geocode_place_cached(place: str):
    """Cache in DB: places_cache(place TEXT PRIMARY KEY, lat DOUBLE, lon DOUBLE, updated_at TIMESTAMP)"""
    if not place:
        return None
    with cursor() as cur:
        cur.execute("CREATE TABLE IF NOT EXISTS places_cache (place VARCHAR(255) PRIMARY KEY, lat DOUBLE, lon DOUBLE, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)")
        cur.execute("SELECT lat, lon FROM places_cache WHERE place=%s", (place,))
        row = cur.fetchone()
        if row and row.get("lat") is not None and row.get("lon") is not None:
            return row

    # Try Nominatim (best effort). If outbound HTTP is blocked, just skip.
    try:
        r = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": place, "format": "json", "limit": 1},
            headers={"User-Agent": "provenance-radar/1.0"},
            timeout=6,
        )
        j = r.json()
        if j:
            lat, lon = float(j[0]["lat"]), float(j[0]["lon"])
        else:
            lat, lon = None, None
    except Exception:
        lat, lon = None, None

    with cursor() as cur:
        cur.execute(
            "INSERT INTO places_cache (place, lat, lon) VALUES (%s,%s,%s) ON DUPLICATE KEY UPDATE lat=VALUES(lat), lon=VALUES(lon), updated_at=CURRENT_TIMESTAMP",
            (place, lat, lon),
        )
    if lat is None or lon is None:
        return None
    return {"lat": lat, "lon": lon}

def _policy_hits_for_date(d: str):
    """Return policy codes a given ISO date falls into."""
    if not d:
        return []
    hits = []
    for w in POLICY_WINDOWS:
        start_ok = (d >= w["from"]) if w["from"] else True
        end_ok   = (d <= w["to"])   if w["to"]   else True
        if start_ok and end_ok:
            hits.append(w["code"])
    return hits

def build_graph_from_events(obj_row, events):
    """Cytoscape.js-style graph: nodes+edges."""
    nodes = []
    edges = []

    # center object node
    onode = {
        "id": f"obj:{obj_row['object_id']}",
        "label": f"{obj_row.get('title') or 'Untitled'} ({obj_row.get('source')})",
        "type": "object"
    }
    nodes_map = {onode["id"]: onode}

    def add_node(kind, label):
        if not label:
            return None
        nid = f"{kind}:{label}"
        if nid not in nodes_map:
            nodes_map[nid] = {"id": nid, "label": label, "type": kind}
        return nid

    for ev in events:
        actor = ev.get("actor")
        place = ev.get("place")
        etype = ev.get("event_type") or "UNKNOWN"
        d_iso = to_iso(ev.get("date_from")) 

        actor_id = add_node("actor", actor) if actor else None
        place_id = add_node("place", place) if place else None

        # Edge semantics: actor -> object; place is context (not endpoint)
        if actor_id:
            edges.append({
                "source": actor_id,
                "target": onode["id"],
                "label": etype,
                "date": d_iso,
                "weight": 1.0,   # client may recompute with risk overlays
                "source_ref": ev.get("source_ref"),
                "policy": _policy_hits_for_date(d_iso)
            })

        # Optional: object -> place (to visualize locations)
        if place_id and place:
            edges.append({
                "source": onode["id"],
                "target": place_id,
                "label": "LOCATED",
                "date": d_iso,
                "weight": 0.5,
                "source_ref": ev.get("source_ref"),
                "policy": _policy_hits_for_date(d_iso)
            })

    return {"nodes": list(nodes_map.values()), "edges": edges}

def build_timeline_from_events_and_sentences(events, sentences):
    """Simple list items for any timeline widget."""
    items = []
    s_by_seq = {s["seq"]: s["sentence"] for s in sentences}
    for ev in events:
        start = to_iso(ev.get("date_from"))
        end   = to_iso(ev.get("date_to"))
        title = ev.get("event_type") or "Event"
        txt   = None
        # Try to pull the nearest sentence by seq if present
        # (ingest stored seq starting at 0)
        for k in (0, 1, 2, 3):
            if k in s_by_seq:
                txt = s_by_seq[k]; break
        items.append({
            "title": title,
            "start_date": start,
            "end_date": end,
            "text": txt or "",
            "source_ref": ev.get("source_ref")
        })
    return items

# ───────────────────────────────────────────────────────────────────────────────
# ROUTES
# ───────────────────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return jsonify({"ok": True, "service": "provenance-radar-api", "device": _DEVICE_INFO})

@app.get("/api/health")
@with_db_retry
def health():
    try:
        start_time = time.time()
        with cursor() as cur:
            cur.execute("SELECT COUNT(*) AS c FROM objects");      objects = cur.fetchone()["c"]
            cur.execute("SELECT COUNT(*) AS c FROM provenance_sentences"); sentences = cur.fetchone()["c"]
            cur.execute("SELECT COUNT(*) AS c FROM risk_signals"); risks = cur.fetchone()["c"]
        
        db_latency = round((time.time() - start_time) * 1000, 2)
        
        return jsonify({
            "ok": True, 
            "device": _DEVICE_INFO, 
            "db_latency_ms": db_latency,
            "counts": {
                "objects": objects, 
                "sentences": sentences, 
                "risk_signals": risks
            }
        })
    except Exception as e:
        log.exception("health failed")
        return jsonify({
            "ok": False, 
            "error": str(e),
            "db_status": "unavailable"
        }), 503

@app.get("/api/policy/windows")
def policy_windows():
    return jsonify({"ok": True, "windows": POLICY_WINDOWS})


@app.get("/api/leads")
@with_db_retry
def get_leads():
    limit = max(1, min(int(request.args.get("limit", 50)), 200))
    min_score = float(request.args.get("min_score", 0))
    source = request.args.get("source")

    sql = (
        "SELECT object_id, source, title, creator, risk_score, top_signals "
        "FROM flagged_leads WHERE risk_score >= %s "
    )
    args = [min_score]
    if source:
        sql += " AND source = %s "
        args.append(source)
    sql += " LIMIT %s"
    args.append(limit)

    with cursor() as cur:
        cur.execute(sql, args)
        rows = cur.fetchall()

    for r in rows:
        _apply_normalized_risk_inplace(r)

    log.info("[RISK] /api/leads called | fetched=%s limit=%s min_score=%s source=%s",
             len(rows), limit, min_score, source or "ALL")

    for i, r in enumerate(rows[:5], start=1):
        raw_ratio = _to_float(r.get("risk_score_raw"))
        raw_pct   = None if raw_ratio is None else round(raw_ratio * 100.0, 2)
        norm_ratio= _to_float(r.get("risk_score"))               # 0–1
        norm_pct  = None if norm_ratio is None else round(norm_ratio * 100.0)  # shown by UI

        log.info(
            "[RISK] lead %d/%d | object_id=%s | title=%s | raw_ratio=%.3f | raw_pct=%s | norm_ratio=%.3f | norm_pct≈%s%%",
            i, min(5, len(rows)),
            r.get("object_id"),
            (r.get("title") or "")[:80],
            raw_ratio if raw_ratio is not None else -1.0,
            f"{raw_pct:.0f}" if raw_pct is not None else "NA",
            norm_ratio if norm_ratio is not None else -1.0,
            f"{norm_pct:.0f}" if norm_pct is not None else "NA",
        )

    resp = jsonify({"ok": True, "data": rows})
    resp.headers["Cache-Control"] = "no-store, max-age=0"
    return resp


@app.get("/api/object/<int:object_id>")
@with_db_retry
def object_detail(object_id: int):
    with cursor() as cur:
        cur.execute("SELECT *, image_url FROM objects WHERE object_id=%s", (object_id,))
        obj = cur.fetchone()
        if not obj:
            return jsonify({"ok": False, "error": "not_found"}), 404

        # --- Normalize + overwrite the field the client reads (0..1) -----------
        raw_ratio = _to_float(obj.get("risk_score"))            # e.g., 2.0 = 200%
        norm_ratio = normalize_risk(raw_ratio) if raw_ratio is not None else None  # 0..1
        norm_0_99  = None if norm_ratio is None else round(norm_ratio * 100.0, 2) # reference

        obj["risk_score_raw"]       = raw_ratio
        obj["risk_score_norm_0_99"] = norm_0_99
        obj["risk_score"]           = norm_ratio                 # what the UI already reads
        obj["risk_score_normalized"]= norm_ratio                 # alias

        # --- Log one line per object fetch (visible on HF console) -------------
        log.info(
            "[RISK] /api/object | object_id=%s | raw_ratio=%s | raw_pct=%s | norm_ratio=%s | norm_pct≈%s%%",
            object_id,
            f"{raw_ratio:.3f}" if raw_ratio is not None else "NA",
            f"{raw_ratio*100:.0f}" if raw_ratio is not None else "NA",
            f"{norm_ratio:.3f}" if norm_ratio is not None else "NA",
            f"{norm_ratio*100:.0f}" if norm_ratio is not None else "NA",
        )

        # -----------------------------------------------------------------------
        cur.execute("SELECT seq, sentence FROM provenance_sentences WHERE object_id=%s ORDER BY seq", (object_id,))
        sents = cur.fetchall()

        cur.execute("""SELECT event_type, date_from, date_to, place, actor, method, source_ref
                       FROM provenance_events WHERE object_id=%s
                       ORDER BY COALESCE(date_from,'0001-01-01')""", (object_id,))
        events = cur.fetchall()

        cur.execute("SELECT code, detail, weight FROM risk_signals WHERE object_id=%s ORDER BY weight DESC", (object_id,))
        risks = cur.fetchall()

    resp = jsonify({"ok": True, "object": obj, "sentences": sents, "events": events, "risks": risks})
    resp.headers["Cache-Control"] = "no-store, max-age=0"
    return resp




@app.get("/api/graph/<int:object_id>")
@with_db_retry
def graph(object_id: int):
    with cursor() as cur:
        cur.execute("SELECT object_id, source, title FROM objects WHERE object_id=%s", (object_id,))
        obj = cur.fetchone()
        if not obj:
            return jsonify({"ok": False, "error": "not_found"}), 404

        cur.execute("""SELECT event_type, date_from, date_to, place, actor, source_ref
                       FROM provenance_events WHERE object_id=%s
                       ORDER BY COALESCE(date_from,'0001-01-01')""", (object_id,))
        events = cur.fetchall()

        cur.execute("SELECT seq, sentence FROM provenance_sentences WHERE object_id=%s ORDER BY seq", (object_id,))
        sents = cur.fetchall()

    inferred = infer_events_from_sentences(sents)

    # Prefer stored events; fill with inferred where stored is thin
    merged = list(events)
    if not merged or all((not e.get("actor") and not e.get("place")) for e in merged):
        merged = inferred
    else:
        # add inferred items that add missing actor/place for the same year
        have = {(e.get("actor"), e.get("place"), e.get("event_type"), to_iso(e.get("date_from"))): True for e in merged}
        for e in inferred:
            key = (e.get("actor"), e.get("place"), e.get("event_type"), to_iso(e.get("date_from")))
            if key not in have:
                merged.append(e)

    g = build_graph_from_events(obj, merged)

    # NEW: link successive actors to show chain of custody
    actors_in_time = [ (to_iso(e.get("date_from")) or "0001-01-01", e.get("actor")) for e in merged if e.get("actor") ]
    actors_in_time.sort(key=lambda x: x[0])
    for i in range(len(actors_in_time) - 1):
        a1 = actors_in_time[i][1]; a2 = actors_in_time[i+1][1]
        if a1 and a2 and a1 != a2:
            g["edges"].append({
                "source": f"actor:{a1}",
                "target": f"actor:{a2}",
                "label": "TRANSFER",
                "date": actors_in_time[i+1][0],
                "weight": 0.8,
                "policy": _policy_hits_for_date(actors_in_time[i+1][0]),
                "source_ref": "link:sequence"
            })

    return jsonify({"ok": True, **g})

@app.get("/api/places/<int:object_id>")
@with_db_retry
def places(object_id: int):
    with cursor() as cur:
        cur.execute("""SELECT place, date_from FROM provenance_events WHERE object_id=%s""", (object_id,))
        ev = cur.fetchall()
        cur.execute("SELECT seq, sentence FROM provenance_sentences WHERE object_id=%s ORDER BY seq", (object_id,))
        sents = cur.fetchall()

    inferred = infer_events_from_sentences(sents)
    all_places = []
    for e in ev + inferred:
        p = _clean(e.get("place"))
        if p:
            all_places.append({"place": p, "date": to_iso(e.get("date_from"))})

    # unique by place, keep earliest date
    agg = {}
    for r in all_places:
        d = r["date"] or "9999-12-31"
        if r["place"] not in agg or d < (agg[r["place"]].get("date") or "9999-12-31"):
            agg[r["place"]] = r

    out = []
    for p, info in agg.items():
        geo = geocode_place_cached(p)  # may be None if geocoding blocked
        out.append({"place": p, "date": info.get("date"), "lat": (geo or {}).get("lat"), "lon": (geo or {}).get("lon")})

    # order chronologically for path drawing
    out.sort(key=lambda x: x.get("date") or "9999-12-31")
    return jsonify({"ok": True, "places": out})
  
@app.get("/api/timeline/<int:object_id>")
@with_db_retry
def timeline(object_id: int):
    with cursor() as cur:
        cur.execute("SELECT seq, sentence FROM provenance_sentences WHERE object_id=%s ORDER BY seq", (object_id,))
        sents = cur.fetchall()
        cur.execute("""SELECT event_type, date_from, date_to, place, actor, source_ref
                       FROM provenance_events WHERE object_id=%s
                       ORDER BY COALESCE(date_from,'0001-01-01')""", (object_id,))
        events = cur.fetchall()
    items = build_timeline_from_events_and_sentences(events, sents)
    return jsonify({"ok": True, "items": items})

@app.get("/api/keyword")
@with_db_retry
def keyword_search():
    q = (request.args.get("q") or "").strip()
    limit = max(1, min(int(request.args.get("limit", 50)), 200))
    if not q:
        return jsonify({"ok": False, "error": "q required"}), 400
    like = "%" + q.replace("%","").replace("_","") + "%"
    with cursor() as cur:
        cur.execute(
            """SELECT ps.object_id, ps.seq, ps.sentence, o.source, o.title, o.creator
               FROM provenance_sentences ps
               JOIN objects o ON o.object_id = ps.object_id
               WHERE ps.sentence LIKE %s
               LIMIT %s""", (like, limit)
        )
        rows = cur.fetchall()
    return jsonify({"ok": True, "query": q, "data": rows})


@app.post("/api/similar")
@with_db_retry
def similar_search():
    payload = request.get_json(force=True) or {}
    text = (payload.get("text") or "").strip()
    limit = max(1, min(int(payload.get("limit", 20)), 100))
    candidates = int(payload.get("candidates", max(200, limit * 10)))  # pre-topK by sentences
    source_filter = (payload.get("source") or "").strip().upper()      # e.g., "AIC"

    if not text:
        return jsonify({"ok": False, "error": "text required"}), 400

    # Embed (existing logic)
    try:
        import torch
        vec_t = _load_model().encode([text], batch_size=1, show_progress_bar=False, convert_to_tensor=True)
        vec = (vec_t[0].detach().cpu().tolist() if isinstance(vec_t, torch.Tensor) else list(vec_t[0]))
    except Exception as e:
        return jsonify({"ok": False, "error": f"embedding_unavailable: {e}"}), 503

    vec_json = json.dumps(_pad(vec, VEC_DIM))
    where_src = "WHERE o.source = %s" if source_filter else ""

    # --- IMPORTANT: dedupe by object_id using window function -----------------
    # We pull top 'candidates' sentences, join to objects (apply optional source),
    # then keep only ROW_NUMBER() = 1 per object_id (best/closest sentence).
    sql = f"""
    WITH nn AS (
      SELECT /*+ USE_INDEX(ps, hnsw_vec) */
             ps.sent_id, ps.object_id, ps.seq, ps.sentence,
             VEC_COSINE_DISTANCE(ps.embedding, CAST(%s AS VECTOR({VEC_DIM}))) AS distance
      FROM provenance_sentences ps
      ORDER BY distance
      LIMIT %s
    ),
    ranked AS (
      SELECT
        nn.object_id,
        nn.seq,
        nn.sentence,
        nn.distance,
        o.source,
        o.title,
        o.creator,
        ROW_NUMBER() OVER (PARTITION BY nn.object_id ORDER BY nn.distance ASC) AS rk
      FROM nn
      JOIN objects o ON o.object_id = nn.object_id
      {where_src}
    )
    SELECT object_id, seq, sentence, source, title, creator, distance
    FROM ranked
    WHERE rk = 1
    ORDER BY distance
    LIMIT %s
    """
    params = [vec_json, candidates]
    if source_filter:
        params.append(source_filter)
    params.append(limit)

    try:
        with cursor() as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()
        return jsonify({
            "ok": True,
            "device": _DEVICE_INFO,
            "query": text,
            "data": rows,
            "meta": {"limit": limit, "candidates": candidates, "source": source_filter or None}
        })
    except OperationalError as e:
        # TiDB OOM (1105) → retry with smaller candidate set
        if e.args and e.args[0] == 1105 and candidates > max(100, limit * 4):
            smaller = max(100, limit * 4)
            params2 = [vec_json, smaller]
            if source_filter:
                params2.append(source_filter)
            params2.append(limit)
            try:
                with cursor() as cur:
                    cur.execute(sql, params2)
                    rows = cur.fetchall()
                return jsonify({
                    "ok": True,
                    "device": _DEVICE_INFO,
                    "query": text,
                    "data": rows,
                    "meta": {"limit": limit, "candidates": smaller, "source": source_filter or None,
                             "note": "retried with smaller candidate set"}
                })
            except Exception as e2:
                return jsonify({"ok": False, "error": f"oom_retry_failed: {e2}"}), 500
        # Not OOM or still failed → fall back to Python-side dedupe below
        # (This keeps you resilient if window functions act up.)
        try:
            # Simple fallback: same as your original query, dedupe in Python.
            where_src2 = "WHERE o.source = %s" if source_filter else ""
            sql2 = f"""
            WITH nn AS (
              SELECT ps.sent_id, ps.object_id, ps.seq, ps.sentence,
                     VEC_COSINE_DISTANCE(ps.embedding, CAST(%s AS VECTOR({VEC_DIM}))) AS distance
              FROM provenance_sentences ps
              ORDER BY distance
              LIMIT %s
            )
            SELECT nn.object_id, nn.seq, nn.sentence, o.source, o.title, o.creator, nn.distance
            FROM nn
            JOIN objects o ON o.object_id = nn.object_id
            {where_src2}
            ORDER BY nn.distance
            LIMIT %s
            """
            params2 = [vec_json, candidates]
            if source_filter:
                params2.append(source_filter)
            params2.append(limit * 5)  # grab extra to allow dedupe
            with cursor() as cur:
                cur.execute(sql2, params2)
                many = cur.fetchall()

            # Python dedupe: keep first (closest) row per object_id
            seen = set()
            out = []
            for r in many:
                oid = r.get("object_id")
                if oid in seen:
                    continue
                seen.add(oid)
                out.append(r)
                if len(out) >= limit:
                    break

            return jsonify({
                "ok": True,
                "device": _DEVICE_INFO,
                "query": text,
                "data": out,
                "meta": {"limit": limit, "candidates": candidates, "source": source_filter or None,
                         "note": "python-dedup fallback"}
            })
        except Exception as e3:
            return jsonify({"ok": False, "error": f"query_failed: {e} (fallback: {e3})"}), 500



@app.get("/api/vocab")
@with_db_retry
def vocab():
    field = (request.args.get("field") or "").strip().lower()
    limit = max(1, min(int(request.args.get("limit", 100)), 500))
    if field not in {"actor", "place", "source", "culture"}:
        return jsonify({"ok": False, "error": "field must be one of actor|place|source|culture"}), 400
    if field in {"actor", "place"}:
        sql = f"SELECT {field} AS v, COUNT(*) AS n FROM provenance_events WHERE {field} IS NOT NULL AND {field}<>'' GROUP BY {field} ORDER BY n DESC LIMIT %s"
    elif field == "source":
        sql = "SELECT source AS v, COUNT(*) AS n FROM objects GROUP BY source ORDER BY n DESC LIMIT %s"
    else:  # culture
        sql = "SELECT culture AS v, COUNT(*) AS n FROM objects WHERE culture IS NOT NULL AND culture<>'' GROUP BY culture ORDER BY n DESC LIMIT %s"
    with cursor() as cur:
        cur.execute(sql, (limit,))
        rows = cur.fetchall()
    return jsonify({"ok": True, "field": field, "data": rows})

# ── Gemini-powered explanations ────────────────────────────────────────────────

@app.get("/api/explain/object/<int:object_id>")
@with_db_retry
def explain_object(object_id: int):
    """Generate a concise, policy-aware research note for an object."""
    with cursor() as cur:
        cur.execute("SELECT object_id, source, title, creator, date_display, risk_score FROM objects WHERE object_id=%s", (object_id,))
        obj = cur.fetchone()
        if not obj:
            return jsonify({"ok": False, "error": "not_found"}), 404
        cur.execute("SELECT seq, sentence FROM provenance_sentences WHERE object_id=%s ORDER BY seq", (object_id,))
        sents = cur.fetchall()
        cur.execute("SELECT event_type, date_from, date_to, place, actor, source_ref FROM provenance_events WHERE object_id=%s ORDER BY COALESCE(date_from,'0001-01-01')", (object_id,))
        events = cur.fetchall()

    # Build a compact prompt (few sentences) to keep latency low
    bullets = []
    for s in sents[:8]:  # keep prompt small
        bullets.append(f"- {s['sentence']}")
    evsumm = []
    for e in events[:8]:
        evsumm.append(f"{e.get('event_type')} @ {e.get('place') or '—'} on {e.get('date_from') or '—'} (actor: {e.get('actor') or '—'})")

    sys = ("You are assisting provenance researchers. Write a neutral, concise brief (120–180 words) that:\n"
           "1) summarizes the chain of custody in plain language; 2) clearly marks any timeline gaps; "
           "3) calls out potential red flags (e.g., confiscated/looted, sales during 1933–45, exports post-1970) "
           "without making legal conclusions; 4) ends with a short 'Next leads' list (max 3).")
    prompt = (
        f"Object: {obj.get('title') or 'Untitled'} — {obj.get('creator') or ''} (source {obj['source']}). "
        f"Display date: {obj.get('date_display') or 'n/a'}. Current risk_score={obj.get('risk_score', 0)}.\n\n"
        f"Provenance sentences:\n" + "\n".join(bullets) + "\n\n"
        f"Structured events (first 8):\n- " + "\n- ".join(evsumm) + "\n\n"
        f"Policy windows to consider: Nazi era 1933–1945; UNESCO 1970 onwards."
    )
    text = gemini_explain(prompt, sys=sys)
    return jsonify({"ok": True, "model": EXPLAIN_MODEL, "note": text})

@app.post("/api/explain/text")
def explain_text():
    """Explain a specific provenance sentence or user query with policy context."""
    payload = request.get_json(force=True) or {}
    sentence = (payload.get("text") or "").strip()
    if not sentence:
        return jsonify({"ok": False, "error": "text required"}), 400
    sys = ("Explain this text as a provenance note for curators. "
           "Be precise and cautious; highlight possible red flags tied to 1933–1945 and post-1970 export rules.")
    prompt = f"""Explain and contextualize this provenance fragment:\n\n{sentence}."""
    text = gemini_explain(prompt, sys=sys)
    return jsonify({"ok": True, "model": EXPLAIN_MODEL, "explanation": text})

# ───────────────────────────────────────────────────────────────────────────────
# MAIN (Spaces expects 7860)
# ───────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.environ.get("PORT", "7860"))
    app.run(host="0.0.0.0", port=port, debug=False)
