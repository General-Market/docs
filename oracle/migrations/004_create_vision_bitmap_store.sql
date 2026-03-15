-- Fresh bitmap table with slot tracking (full redeploy, wipe previous bitmaps)
DROP TABLE IF EXISTS vision_bitmaps;
CREATE TABLE vision_bitmaps (
    batch_id        BIGINT NOT NULL,
    player          TEXT NOT NULL,
    bitmap          BYTEA NOT NULL,
    bitmap_hash     TEXT NOT NULL,
    slot            TEXT NOT NULL DEFAULT 'pending',
    target_tick_id  BIGINT NOT NULL DEFAULT 0,
    config_hash     TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (batch_id, player, slot)
);

DROP TABLE IF EXISTS vision_batch_state;
CREATE TABLE vision_batch_state (
    batch_id                BIGINT PRIMARY KEY,
    current_tick_id         BIGINT NOT NULL DEFAULT 0,
    last_resolved_tick_id   BIGINT NOT NULL DEFAULT 0,
    active_config_hash      TEXT NOT NULL DEFAULT ''
);
