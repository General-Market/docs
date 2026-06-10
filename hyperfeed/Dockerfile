FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . /app/hyperfeed

RUN mkdir -p /app/hyperfeed/state

# The Hyperliquid vocabulary is imported from the radar, bind-mounted read-only at /app/x-targeting.
ENV X_TARGETING_DIR=/app/x-targeting

WORKDIR /app
CMD ["python", "-m", "hyperfeed.main"]
