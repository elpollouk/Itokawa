-- Session Storage Table
CREATE TABLE
    user_sessions
(
    id VARCHAR PRIMARY KEY,
    userId INTEGER,
    exires INTEGER
);

CREATE INDEX user_sessions_expires_idx ON user_sessions(exires);
