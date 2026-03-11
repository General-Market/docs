FROM debian:trixie-slim
RUN apt-get update && apt-get install -y ca-certificates libssl3 libpq5 curl && rm -rf /var/lib/apt/lists/*
RUN useradd -r -s /bin/false app && mkdir -p /app && chown -R app:app /app
COPY target/release/ap /usr/local/bin/
USER app
WORKDIR /app
ENTRYPOINT ["ap"]
