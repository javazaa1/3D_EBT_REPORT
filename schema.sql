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
  updated_at  TEXT,
  vid         TEXT                      -- version the comment was made on (NULL = first version)
);
CREATE INDEX IF NOT EXISTS idx_comments_page   ON comments(page, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);

-- Pages in the sidebar and their versions (filled automatically from uploads/ and web uploads)
CREATE TABLE IF NOT EXISTS pages (
  key TEXT PRIMARY KEY, site TEXT, unit TEXT, descr TEXT, label TEXT,
  sort INTEGER NOT NULL DEFAULT 1000, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS versions (
  key TEXT NOT NULL, vid TEXT NOT NULL,     -- vid = first 8 hex of SHA-1 of the uploaded HTML
  no INTEGER NOT NULL,                      -- v1, v2, … per page
  title TEXT, note TEXT, is3d INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL,                     -- git | web
  author TEXT, created_at TEXT NOT NULL,
  PRIMARY KEY (key, vid)
);
