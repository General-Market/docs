# Stage 1: Build
FROM rust:slim-bookworm AS builder
RUN apt-get update && apt-get install -y pkg-config libssl-dev libpq-dev perl make && rm -rf /var/lib/apt/lists/*
WORKDIR /build
COPY Cargo.toml Cargo.lock ./
COPY itp-bot/ itp-bot/
COPY common/ common/
RUN sed -i '/"oracle"/d; /"ap"/d; /"curator"/d; /"data-node"/d' Cargo.toml
RUN cargo build --release -p itp-bot

# Stage 2: Runtime
FROM debian:trixie-slim
RUN apt-get update && apt-get install -y ca-certificates libssl3 curl && rm -rf /var/lib/apt/lists/*
RUN useradd -r -s /bin/false app && mkdir -p /app && chown -R app:app /app
COPY --from=builder /build/target/release/itp-bot /usr/local/bin/
USER app
WORKDIR /app
ENTRYPOINT ["itp-bot"]
