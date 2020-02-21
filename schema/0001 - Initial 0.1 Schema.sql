-- Initial Schema for v0.1 release

-- Loco repository and full text search index
CREATE TABLE
    locos
(
    id INTEGER PRIMARY KEY,
    search_text VARCHAR,
    item JSON
);

CREATE VIRTUAL TABLE
    locos_fts
USING
    fts5
(
    content='locos',
    id UNINDEXED,
    search_text
);

CREATE TRIGGER locos_bu BEFORE UPDATE ON locos BEGIN
    DELETE FROM locos_fts WHERE id=old.id;
END;
CREATE TRIGGER locos_bd BEFORE DELETE ON locos BEGIN
    DELETE FROM locos_fts WHERE id=old.rowid;
END;
CREATE TRIGGER locos_au AFTER UPDATE ON locos BEGIN
    INSERT INTO locos_fts(id, search_text) VALUES(new.id, new.search_text);
END;
CREATE TRIGGER locos_ai AFTER INSERT ON locos BEGIN
    INSERT INTO locos_fts(id, search_text) VALUES(new.id, new.search_text);
END;

