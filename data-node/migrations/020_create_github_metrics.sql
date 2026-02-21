CREATE TABLE IF NOT EXISTS github_metrics (
    coin_id                     TEXT NOT NULL,
    snapshot_date               DATE NOT NULL,
    stars                       INTEGER,
    forks                       INTEGER,
    subscribers                 INTEGER,
    total_issues                INTEGER,
    closed_issues               INTEGER,
    pull_requests_merged        INTEGER,
    pull_request_contributors   INTEGER,
    commit_count_4_weeks        INTEGER,
    PRIMARY KEY (coin_id, snapshot_date)
);
CREATE INDEX IF NOT EXISTS idx_github_coin_date ON github_metrics(coin_id, snapshot_date);
