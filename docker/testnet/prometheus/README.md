# Prometheus (not yet running)

This directory is a placeholder for when the testnet grows alerting.
No Prometheus container runs today. The rules file exists so that
standing up the stack is a single compose edit instead of a blank
page at 3 a.m.

## Activation

1. Add a `prometheus` service to a new `docker/testnet/prometheus/docker-compose.yml`:

   ```yaml
   services:
     prometheus:
       image: prom/prometheus:latest
       container_name: testnet-prometheus
       network_mode: host
       volumes:
         - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
         - ./rules:/etc/prometheus/rules:ro
       restart: unless-stopped
       logging:
         driver: json-file
         options:
           max-size: "50m"
           max-file: "5"
   ```

2. Create `prometheus.yml`:

   ```yaml
   global:
     scrape_interval: 30s
     evaluation_interval: 30s
   rule_files:
     - /etc/prometheus/rules/alerts.yml
   scrape_configs:
     - job_name: node
       static_configs:
         - targets: ["localhost:9100"]
     - job_name: postgres
       static_configs:
         - targets: ["localhost:9187"]
     - job_name: data_node
       metrics_path: /metrics
       static_configs:
         - targets: ["localhost:8200"]
     - job_name: ap
       metrics_path: /metrics
       static_configs:
         - targets: ["localhost:9100"]
     - job_name: oracle
       metrics_path: /metrics
       static_configs:
         - targets:
             - localhost:10001
             - localhost:10002
             - localhost:10003
   ```

3. Several alert rules reference metrics that are not yet exported
   (`data_node_last_kline_insert_ts`, `last_itp_nav_updated_ts`,
   `ap_orders_processed`, `oracle_stalled`). They need `/metrics`
   endpoints or a sidecar that translates `/health` JSON to Prometheus
   format. The rule file carries TODO comments at each such metric.

4. Once active, wire Alertmanager and send to whatever destination the
   team accepts. The simpler the channel, the faster the fix.
