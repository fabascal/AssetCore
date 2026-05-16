-- =============================================
-- Migración: Tablas de Proyectos y Gantt
-- Fecha: 2026-03-20
-- =============================================

-- Enums
CREATE TYPE project_status AS ENUM ('PLANNING', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'CANCELLED');
CREATE TYPE gantt_task_status AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE dependency_type AS ENUM ('FINISH_TO_START', 'START_TO_START', 'FINISH_TO_FINISH', 'START_TO_FINISH');

-- Tabla: projects
CREATE TABLE projects (
    id            SERIAL PRIMARY KEY,
    name          TEXT NOT NULL,
    description   TEXT,
    status        project_status NOT NULL DEFAULT 'PLANNING',
    start_date    DATE,
    end_date      DATE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabla: project_tasks
CREATE TABLE project_tasks (
    id              SERIAL PRIMARY KEY,
    project_id      INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    parent_task_id  INT REFERENCES project_tasks(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    description     TEXT,
    status          gantt_task_status NOT NULL DEFAULT 'PENDING',
    start_date      DATE,
    end_date        DATE,
    progress        INT NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    is_critical     BOOLEAN NOT NULL DEFAULT false,
    is_milestone    BOOLEAN NOT NULL DEFAULT false,
    sort_order      INT NOT NULL DEFAULT 0,
    assigned_to_id  INT REFERENCES users(id) ON DELETE SET NULL,
    asset_id        INT REFERENCES assets(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_tasks_project ON project_tasks(project_id);
CREATE INDEX idx_project_tasks_parent ON project_tasks(parent_task_id);
CREATE INDEX idx_project_tasks_assigned ON project_tasks(assigned_to_id);

-- Tabla: task_dependencies
CREATE TABLE task_dependencies (
    id              SERIAL PRIMARY KEY,
    predecessor_id  INT NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
    successor_id    INT NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
    type            dependency_type NOT NULL DEFAULT 'FINISH_TO_START',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (predecessor_id, successor_id)
);

CREATE INDEX idx_task_dep_predecessor ON task_dependencies(predecessor_id);
CREATE INDEX idx_task_dep_successor ON task_dependencies(successor_id);

-- Permisos de proyectos
INSERT INTO permissions (code, label, description)
VALUES
  ('projects.read',  'Ver Proyectos',     'Permite consultar proyectos y tareas Gantt'),
  ('projects.write', 'Editar Proyectos',  'Permite crear, editar y eliminar proyectos y tareas');

-- Asignar ambos permisos al rol admin (id=1)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 1, id FROM permissions WHERE code IN ('projects.read', 'projects.write');

-- Asignar lectura al rol tech (id=2)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 2, id FROM permissions WHERE code = 'projects.read';
