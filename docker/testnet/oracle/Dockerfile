# Stage 1: Build oracle binary
FROM rust:slim-bookworm AS builder
RUN apt-get update && apt-get install -y pkg-config libssl-dev libpq-dev perl && rm -rf /var/lib/apt/lists/*
WORKDIR /build
COPY Cargo.toml Cargo.lock ./
COPY oracle/ oracle/
COPY common/ common/
# Strip workspace to only oracle + common (avoid copying ap, curator, data-node, itp-bot)
RUN sed -i 's/members = \[/members = [/' Cargo.toml && \
    sed -i '/"ap"/d; /"curator"/d; /"data-node"/d; /"itp-bot"/d' Cargo.toml
RUN cargo build --release -p oracle

# Stage 2: Runtime
FROM debian:trixie-slim
RUN apt-get update && apt-get install -y ca-certificates libssl3 libpq5 curl && rm -rf /var/lib/apt/lists/*
RUN useradd -r -s /bin/false app && mkdir -p /app/logs && chown -R app:app /app
COPY --from=builder /build/target/release/oracle /usr/local/bin/
USER app
WORKDIR /app
ENTRYPOINT ["oracle"]
