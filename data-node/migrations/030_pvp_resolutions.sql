-- PvP cohort resolutions: a permanent record of every settled head-to-head
-- pair across both boards (Stars 4h F1, Cams 2m F1 plus F2). Markets rotate
-- but the archive does not. The cohort_rotation_worker writes one row per
-- (pair_index, cohort_start) -- idempotent via the composite primary key.
CREATE TABLE IF NOT EXISTS pvp_resolutions (
    pair_index   integer NOT NULL,
    board        text    NOT NULL,            -- 'stars' | 'cams'
    format       text    NOT NULL,            -- 'f1-gain-race' | 'f2-viewer-total'
    cohort_start bigint  NOT NULL,            -- unix-seconds, floor(now / window) * window
    cohort_end   bigint  NOT NULL,            -- cohort_start + window_secs
    slug_a       text    NOT NULL,
    slug_b       text    NOT NULL,
    baseline_a   numeric(80, 0),
    baseline_b   numeric(80, 0),
    final_a      numeric(80, 0),
    final_b      numeric(80, 0),
    score        numeric(80, 0),              -- signed: positive => A wins
    winner       text,                        -- 'a' | 'b' | 'tie' | 'missing'
    resolved_at  timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (pair_index, cohort_start)
);

CREATE INDEX IF NOT EXISTS idx_pvp_res_cohort ON pvp_resolutions (cohort_start DESC);
CREATE INDEX IF NOT EXISTS idx_pvp_res_board  ON pvp_resolutions (board, cohort_start DESC);
