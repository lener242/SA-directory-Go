
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(32) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          VARCHAR(20) NOT NULL DEFAULT 'user', -- user | moderator | admin
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    last_login    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

CREATE TABLE IF NOT EXISTS reg_attempts (
    ip         VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reg_ip ON reg_attempts(ip);

CREATE TABLE IF NOT EXISTS chat_messages (
    id         SERIAL PRIMARY KEY,
    user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message    TEXT NOT NULL,
    deleted    BOOLEAN DEFAULT false,
    deleted_by INT REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_created ON chat_messages(created_at DESC);

CREATE TABLE IF NOT EXISTS admin_log (
    id         SERIAL PRIMARY KEY,
    admin_id   INT REFERENCES users(id),
    action     VARCHAR(20) NOT NULL, 
    table_name VARCHAR(30) NOT NULL,
    item_id    INT,
    details    TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE favourites ADD COLUMN IF NOT EXISTS db_user_id INT REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE admin_log ALTER COLUMN admin_id DROP NOT NULL;

DROP VIEW IF EXISTS search_all;
CREATE VIEW search_all AS
    SELECT
        a.id,
        a.section_id,
        s.title AS section_title,
        'article' AS item_type,
        a.article AS code,
        a.name AS title,
        a.description,
        a.punishment,
        a.fine,
        a.has_conviction,
        a.stars,
        a.important,
        NULL::jsonb AS items
    FROM articles a
    JOIN sections s ON s.id = a.section_id
    UNION ALL
    SELECT
        i.id,
        i.section_id,
        s.title AS section_title,
        'info' AS item_type,
        i.number AS code,
        i.title,
        i.description,
        NULL, NULL, NULL, NULL, NULL,
        i.items
    FROM info_items i
    JOIN sections s ON s.id = i.section_id;

DROP VIEW IF EXISTS search_all;
CREATE VIEW search_all AS
    SELECT
        a.id,
        a.section_id,
        s.title AS section_title,
        'article' AS item_type,
        a.article AS code,
        a.name AS title,
        a.description,
        a.punishment,
        a.fine,
        a.has_conviction,
        a.stars,
        a.important,
        NULL::jsonb AS items
    FROM articles a
    JOIN sections s ON s.id = a.section_id
    UNION ALL
    SELECT
        i.id,
        i.section_id,
        s.title AS section_title,
        'info' AS item_type,
        i.number AS code,
        i.title,
        i.description,
        NULL, NULL, NULL, NULL, NULL,
        i.items
    FROM info_items i
    JOIN sections s ON s.id = i.section_id;
