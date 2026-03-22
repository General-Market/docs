FROM rust:slim-bookworm AS builder
RUN apt-get update && apt-get install -y pkg-config libssl-dev libpq-dev perl make && rm -rf /var/lib/apt/lists/*
WORKDIR /build
COPY Cargo.toml Cargo.lock ./
COPY data-node/ data-node/
COPY common/ common/
RUN sed -i '/"oracle"/d; /"ap"/d; /"curator"/d; /"itp-bot"/d' Cargo.toml
RUN cargo build --release -p data-node

FROM debian:trixie-slim
RUN apt-get update && apt-get install -y ca-certificates libssl3 libpq5 curl && rm -rf /var/lib/apt/lists/*
RUN useradd -r -s /bin/false app && mkdir -p /app/logs && chown -R app:app /app
COPY --from=builder /build/target/release/data-node /usr/local/bin/
USER app
WORKDIR /app
ENTRYPOINT ["data-node"]
