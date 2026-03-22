# Stage 1: Build oracle binary
FROM rust:1.86-slim-bookworm AS builder
RUN apt-get update && apt-get install -y pkg-config libssl-dev libpq-dev && rm -rf /var/lib/apt/lists/*
WORKDIR /build
COPY Cargo.toml Cargo.lock ./
COPY oracle/ oracle/
COPY common/ common/
COPY ap/ ap/
COPY curator/ curator/
COPY data-node/ data-node/
COPY itp-bot/ itp-bot/
RUN cargo build --release -p oracle

# Stage 2: Runtime
FROM debian:trixie-slim
RUN apt-get update && apt-get install -y ca-certificates libssl3 libpq5 curl && rm -rf /var/lib/apt/lists/*
RUN useradd -r -s /bin/false app && mkdir -p /app/logs && chown -R app:app /app
COPY --from=builder /build/target/release/oracle /usr/local/bin/
USER app
WORKDIR /app
ENTRYPOINT ["oracle"]
