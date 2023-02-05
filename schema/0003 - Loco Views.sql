-- Loco Views Support

-- Tables/Indices
CREATE TABLE
    loco_views
(
    id INTEGER PRIMARY KEY,
    name VARCHAR NOT NULL,

    UNIQUE(name)
);

CREATE INDEX loco_views_name_idx ON loco_views(name);

CREATE TABLE
    loco_view_mapping
(
    viewId INTEGER NOT NULL,
    locoId INTEGER NOT NULL,

    UNIQUE(viewId, locoId),
    FOREIGN KEY (viewId) REFERENCES loco_views(id),
    FOREIGN KEY (locoId) REFERENCES locos(id)
);

CREATE INDEX loco_view_mapping_viewId_idx ON loco_view_mapping(viewId);
CREATE INDEX loco_view_mapping_locoId_idx ON loco_view_mapping(locoId);

-- Triggers
DROP TRIGGER locos_bd; -- Update the existing trigger on the locos table
CREATE TRIGGER locos_bd BEFORE DELETE ON locos BEGIN
    DELETE FROM locos_fts WHERE id=old.rowid;
    DELETE FROM loco_view_mapping WHERE locoId=old.rowid;
END;

CREATE TRIGGER loco_views_bd BEFORE DELETE ON loco_views BEGIN
    DELETE FROM loco_view_mapping WHERE viewId=old.rowid;
END;

-- Required "On Track" view
INSERT INTO loco_views(name) VALUES ("On Track");