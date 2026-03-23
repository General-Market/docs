# Unified multi-stage Dockerfile for all Rust services.
# Build args:
#   SERVICE        — workspace member to build (oracle, data-node, ap, curator, itp-bot)
#   EXTRA_MEMBERS  — additional workspace members needed beyond common + SERVICE (space-separated)
#   EXTRA_BINS     — additional binaries to build and copy (space-separated)
#   RUNTIME_DEPS   — override runtime apt packages (default covers all services)
#
# No CMD/ENTRYPOINT — each service specifies its command in docker-compose.

# ---------------------------------------------------------------------------
# Build stage
# ---------------------------------------------------------------------------
FROM rust:1.85-bookworm AS builder
WORKDIR /app

# perl + make: required by vendored OpenSSL (openssl-sys crate in data-node/itp-bot)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential pkg-config libssl-dev libpq-dev perl make && \
    rm -rf /var/lib/apt/lists/*

ARG SERVICE
ARG EXTRA_MEMBERS=""
ARG EXTRA_BINS=""

# Copy workspace manifests + all crate directories for dependency resolution
COPY Cargo.toml Cargo.lock ./
COPY common/ common/
COPY oracle/ oracle/
COPY data-node/ data-node/
COPY itp-bot/ itp-bot/
COPY ap/ ap/
COPY curator/ curator/

# Strip workspace to only needed members.
# Extract member names from the members array (lines matching `    "name"`),
# then delete lines for members not in KEEP list.
RUN KEEP="common ${SERVICE} ${EXTRA_MEMBERS}" && \
    for member in $(sed -n '/^members/,/^\]/p' Cargo.toml | grep -oP '"\K[^"]+'); do \
      echo " $KEEP " | grep -q " $member " || sed -i "/\"$member\"/d" Cargo.toml; \
    done

# Build primary binary + any extras
RUN cargo build --release --bin ${SERVICE} && \
    mkdir -p /output/bin && \
    cp target/release/${SERVICE} /output/bin/ && \
    for bin in ${EXTRA_BINS}; do \
      cargo build --release --bin $bin && \
      cp target/release/$bin /output/bin/; \
    done

# ---------------------------------------------------------------------------
# Runtime stage
# ---------------------------------------------------------------------------
FROM debian:bookworm-slim AS runtime

ARG RUNTIME_DEPS="ca-certificates libssl3 libpq5 curl"
RUN apt-get update && apt-get install -y --no-install-recommends ${RUNTIME_DEPS} && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /output/bin/ /usr/local/bin/

RUN useradd -r -s /bin/false svc && mkdir -p /app/logs && chown -R svc:svc /app
USER svc
WORKDIR /app
