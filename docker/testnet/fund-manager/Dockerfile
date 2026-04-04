FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
RUN useradd -r -s /bin/false bot && mkdir -p /app/deployments /app/pnl-data && chown -R bot:bot /app

WORKDIR /app
COPY vision-bot/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY vision-bot/fund_manager.py vision-bot/funds.toml ./
COPY vision-bot/framework/ ./framework/
COPY vision-bot/strategies/ ./strategies/
COPY deployments/active-deployment.json deployments/active-deployment.json
COPY deployments/vision-batches.json deployments/vision-batches.json

USER bot
ENTRYPOINT ["python", "fund_manager.py", "/app/funds.toml"]
