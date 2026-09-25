-- D1 schema for review comments
CREATE TABLE IF NOT EXISTS comments (
  id          TEXT PRIMARY KEY,
  page        TEXT NOT NULL,            -- ct5-3d, ch-sheet, …  (folder name under /pages)
  parent_id   TEXT,                     -- NULL = top-level comment, otherwise a reply
  no          INTEGER,                  -- pin number per page (top-level only)
  author      TEXT NOT NULL,
  part        TEXT,                     -- ส่วน / อุปกรณ์
  body        TEXT NOT NULL,
  review_date TEXT,                     -- YYYY-MM-DD chosen in the form
  anchor      TEXT,                     -- JSON: where the pin is
  view        TEXT,                     -- JSON: 3D camera {p,t}
  images      TEXT NOT NULL DEFAULT '[]', -- JSON array of R2 keys
  status      TEXT NOT NULL DEFAULT 'open', -- open | done
  created_at  TEXT NOT NULL,
  updated_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_comments_page   ON comments(page, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);
