FROM debian:trixie-slim
RUN apt-get update && apt-get install -y ca-certificates libssl3 libpq5 && rm -rf /var/lib/apt/lists/*
RUN useradd -r -s /bin/false app && mkdir -p /app && chown -R app:app /app
COPY target/release/curator /usr/local/bin/
USER app
WORKDIR /app
ENTRYPOINT ["curator"]
