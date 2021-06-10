-- Session Storage Table
CREATE TABLE
    user_sessions
(
    id VARCHAR PRIMARY KEY,
    userId INTEGER NOT NULL,
    expires INTEGER NOT NULL
);

CREATE INDEX user_sessions_expires_idx ON user_sessions(expires);
