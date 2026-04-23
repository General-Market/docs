# sfdata-node — scrape-isolated data-node.
#
# Builds the sfdata-node binary (defined in data-node/src/sf_main.rs) but
# ships it as its own container with its own migration set. Functionally
# identical build pipeline to docker/rust-service.Dockerfile; the only
# difference is that sfdata-node shares the data-node crate, so migrations
# come from data-node/migrations rather than sfdata-node/migrations.

FROM rust:1.88-bookworm AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential pkg-config libssl-dev libpq-dev perl make && \
    rm -rf /var/lib/apt/lists/*

COPY Cargo.toml Cargo.lock ./
COPY common/ common/
COPY oracle/ oracle/
COPY data-node/ data-node/
COPY itp-bot/ itp-bot/
COPY ap/ ap/
COPY curator/ curator/

# Strip workspace to common + data-node only.
RUN KEEP="common data-node" && \
    for member in $(sed -n '/^members/,/^\]/p' Cargo.toml | grep -oP '"\K[^"]+'); do \
      echo " $KEEP " | grep -q " $member " || sed -i "/\"$member\"/d" Cargo.toml; \
    done

RUN cargo build --release --bin sfdata-node && \
    mkdir -p /output/bin /output/migrations && \
    cp target/release/sfdata-node /output/bin/ && \
    cp -r data-node/migrations/* /output/migrations/


FROM debian:bookworm-slim AS runtime
ARG RUNTIME_DEPS="ca-certificates libssl3 libpq5 curl"
RUN apt-get update && apt-get install -y --no-install-recommends ${RUNTIME_DEPS} && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /output/bin/ /usr/local/bin/
COPY --from=builder /output/migrations/ /app/migrations/

RUN useradd -r -s /bin/false svc && mkdir -p /app/logs && chown -R svc:svc /app
USER svc
WORKDIR /app
ENTRYPOINT ["sfdata-node"]
