FROM debian:trixie-slim
RUN apt-get update && apt-get install -y ca-certificates libssl3 curl && rm -rf /var/lib/apt/lists/*
RUN useradd -r -s /bin/false app && mkdir -p /app && chown -R app:app /app
COPY target/release/itp-bot /usr/local/bin/
COPY itp-bot/manifest.json /app/manifest.json
COPY frontend/public/deployed-assets.json /app/deployed-assets.json
USER app
WORKDIR /app
ENTRYPOINT ["itp-bot"]
