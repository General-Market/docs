import json
import threading
import time
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

from tools.anomalies import get_anomalies, skip_anomaly
from tools.investigate import search_assets, get_history, get_frequency, get_compare, list_assets
from tools.publish import approve_anomaly, get_last_posted, get_posted
from tools.stats import get_stats
from engine.detector import run_detection
from migrate import migrate

app = Server("social-bot")

TOOLS = [
    Tool(name="get_anomalies", description="Get pending anomaly candidates. Returns newsworthy events detected from 98 data sources.", inputSchema={
        "type": "object",
        "properties": {
            "source": {"type": "string", "description": "Filter by source (e.g., 'earthquake', 'sec')"},
            "limit": {"type": "integer", "description": "Max candidates to return (default 20)"},
        },
    }),
    Tool(name="skip_tweet", description="Skip/reject an anomaly candidate.", inputSchema={
        "type": "object",
        "properties": {
            "id": {"type": "string", "description": "Anomaly ID"},
            "reason": {"type": "string", "description": "Why it's not newsworthy"},
        },
        "required": ["id", "reason"],
    }),
    Tool(name="search", description="Search all historical market assets by name/symbol. Includes archived assets no longer being synced.", inputSchema={
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Search term"},
            "source": {"type": "string", "description": "Filter by source"},
            "days": {"type": "integer", "description": "Limit to assets active in last N days"},
        },
        "required": ["query"],
    }),
    Tool(name="get_history", description="Full price/value time series for any asset. Works for live and archived assets.", inputSchema={
        "type": "object",
        "properties": {
            "source": {"type": "string"},
            "asset_id": {"type": "string"},
            "days": {"type": "integer", "description": "How many days of history (default 30)"},
        },
        "required": ["source", "asset_id"],
    }),
    Tool(name="get_frequency", description="Count how many times an event type occurred in a time window.", inputSchema={
        "type": "object",
        "properties": {
            "source": {"type": "string"},
            "event_type": {"type": "string", "description": "Event type to search for (partial match)"},
            "region": {"type": "string", "description": "Optional region filter"},
            "days": {"type": "integer", "description": "Time window in days (default 7)"},
        },
        "required": ["source", "event_type"],
    }),
    Tool(name="get_compare", description="Compare current value to rolling averages (7d/30d/90d/1y), min/max, and find when it was last this high/low.", inputSchema={
        "type": "object",
        "properties": {
            "source": {"type": "string"},
            "asset_id": {"type": "string"},
        },
        "required": ["source", "asset_id"],
    }),
    Tool(name="list_assets", description="List all assets for a source, optionally filtered by date range.", inputSchema={
        "type": "object",
        "properties": {
            "source": {"type": "string"},
            "from_date": {"type": "string", "description": "Start date (YYYY-MM-DD)"},
            "to_date": {"type": "string", "description": "End date (YYYY-MM-DD)"},
            "active_only": {"type": "boolean", "description": "Only active assets (default true)"},
        },
        "required": ["source"],
    }),
    Tool(name="approve_tweet", description="Mark an anomaly as approved in the DB. Does NOT post — the /loop writes to scheduled.csv locally, and poster.py posts from the Mac.", inputSchema={
        "type": "object",
        "properties": {
            "id": {"type": "string", "description": "Anomaly ID"},
            "final_tweet": {"type": "string", "description": "The tweet text (max 280 chars)"},
            "account": {"type": "string", "description": "Account to post from"},
            "outcome_tag": {"type": "string", "description": "FEAR, LOOK, MONEY, RAGE, WTF, WATCH, or RECORD"},
            "virality_score": {"type": "integer", "description": "1-10 virality rating"},
        },
        "required": ["id", "final_tweet", "account", "outcome_tag", "virality_score"],
    }),
    Tool(name="get_last_posted", description="Recent tweets per account.", inputSchema={
        "type": "object",
        "properties": {
            "account": {"type": "string", "description": "Filter by account name"},
            "limit": {"type": "integer"},
        },
    }),
    Tool(name="get_posted", description="All tweets posted in the last N days.", inputSchema={
        "type": "object",
        "properties": {"days": {"type": "integer", "description": "Lookback days (default 1)"}},
    }),
    Tool(name="get_stats", description="Dashboard: pending count, posted today per account, skip rate.", inputSchema={
        "type": "object", "properties": {},
    }),
]

@app.list_tools()
async def list_tools():
    return TOOLS

@app.call_tool()
async def call_tool(name: str, arguments: dict):
    handlers = {
        "get_anomalies": lambda: get_anomalies(arguments.get("source"), arguments.get("limit", 20)),
        "skip_tweet": lambda: skip_anomaly(arguments["id"], arguments["reason"]),
        "search": lambda: search_assets(arguments["query"], arguments.get("source"), arguments.get("days", 90)),
        "get_history": lambda: get_history(arguments["source"], arguments["asset_id"], arguments.get("days", 30)),
        "get_frequency": lambda: get_frequency(arguments["source"], arguments["event_type"], arguments.get("region"), arguments.get("days", 7)),
        "get_compare": lambda: get_compare(arguments["source"], arguments["asset_id"]),
        "list_assets": lambda: list_assets(arguments["source"], arguments.get("from_date"), arguments.get("to_date"), arguments.get("active_only", True)),
        "approve_tweet": lambda: approve_anomaly(arguments["id"], arguments["final_tweet"], arguments["account"], arguments["outcome_tag"], arguments["virality_score"]),
        "get_last_posted": lambda: get_last_posted(arguments.get("account"), arguments.get("limit", 10)),
        "get_posted": lambda: get_posted(arguments.get("days", 1)),
        "get_stats": lambda: get_stats(),
    }
    result = handlers[name]()
    return [TextContent(type="text", text=json.dumps(result, default=str, indent=2))]

# -- Background anomaly detection --

def detection_loop():
    """Runs anomaly detection every 2 minutes in background."""
    while True:
        try:
            candidates = run_detection()
            if candidates:
                print(f"[detector] Found {len(candidates)} new anomalies", flush=True)
        except Exception as e:
            print(f"[detector] Error: {e}", flush=True)
        time.sleep(120)

async def main():
    migrate()
    t = threading.Thread(target=detection_loop, daemon=True)
    t.start()
    async with stdio_server() as (read, write):
        await app.run(read, write, app.create_initialization_options())

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
