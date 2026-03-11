FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates libssl3 libpq5 curl && rm -rf /var/lib/apt/lists/*
RUN useradd -r -s /bin/false app && mkdir -p /app/logs && chown -R app:app /app
COPY target/release/data-node /usr/local/bin/
USER app
WORKDIR /app
ENTRYPOINT ["data-node"]
