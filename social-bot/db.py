import os
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()

def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])

def query(sql, params=None):
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            return cur.fetchall()

def query_one(sql, params=None):
    rows = query(sql, params)
    return rows[0] if rows else None

def execute(sql, params=None):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
        conn.commit()
