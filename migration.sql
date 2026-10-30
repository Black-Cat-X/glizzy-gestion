-- =============================================================
-- Glizzy Gestión — Migración Fase 1
-- Ejecutar en Supabase > SQL Editor (correr completo de una vez)
-- =============================================================

-- TABLAS ----------------------------------------------------------

CREATE TABLE IF NOT EXISTS insumos (
  id                 SERIAL PRIMARY KEY,
  nombre             TEXT UNIQUE NOT NULL,
  unidad             TEXT NOT NULL,
  minimo_semana_baja INT NOT NULL DEFAULT 0,
  descuento_auto     BOOLEAN NOT NULL DEFAULT true,
  activo             BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS productos (
  clave  TEXT PRIMARY KEY,
  nombre TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recetas (
  producto   TEXT NOT NULL REFERENCES productos(clave),
  insumo_id  INT  NOT NULL REFERENCES insumos(id),
  cantidad   NUMERIC NOT NULL,
  PRIMARY KEY (producto, insumo_id)
);

CREATE TABLE IF NOT EXISTS reportes_venta (
  fecha         DATE PRIMARY KEY,
  vendedor      TEXT NOT NULL,
  firma         TEXT NOT NULL,
  num_ventas    INT NOT NULL DEFAULT 0,
  perros        INT NOT NULL DEFAULT 0,
  combos        INT NOT NULL DEFAULT 0,
  gaseosas_sueltas INT NOT NULL DEFAULT 0,
  adic_ca       INT NOT NULL DEFAULT 0,
  adic_ce       INT NOT NULL DEFAULT 0,
  adic_po       INT NOT NULL DEFAULT 0,
  tostilocos    INT NOT NULL DEFAULT 0,
  dorilokos     INT NOT NULL DEFAULT 0,
  efectivo      INT NOT NULL DEFAULT 0,
  transferencia INT NOT NULL DEFAULT 0,
  total         INT NOT NULL DEFAULT 0,
  cuadra        BOOLEAN NOT NULL DEFAULT true,
  payload       TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ventas_detalle (
  id             SERIAL PRIMARY KEY,
  fecha_reporte  DATE NOT NULL REFERENCES reportes_venta(fecha) ON DELETE CASCADE,
  hora           TEXT NOT NULL,
  total          INT NOT NULL,
  metodo         INT NOT NULL CHECK (metodo IN (0, 1)),
  items          JSONB NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS movimientos_stock (
  id             SERIAL PRIMARY KEY,
  fecha          DATE NOT NULL,
  insumo_id      INT NOT NULL REFERENCES insumos(id),
  tipo           TEXT NOT NULL CHECK (tipo IN ('venta', 'compra', 'gasto', 'perdida', 'agregar')),
  cantidad       NUMERIC NOT NULL,           -- positivo = entrada, negativo = salida
  valor_total    NUMERIC,                    -- solo compras
  costo_unitario NUMERIC,                    -- solo compras
  fecha_reporte  DATE REFERENCES reportes_venta(fecha) ON DELETE CASCADE  -- solo ventas
);

CREATE TABLE IF NOT EXISTS gastos (
  id            SERIAL PRIMARY KEY,
  fecha         DATE NOT NULL,
  categoria     TEXT NOT NULL CHECK (categoria IN ('inventario', 'arriendo', 'empleado_base', 'empleado_bono', 'imprevisto')),
  concepto      TEXT NOT NULL,
  valor         INT NOT NULL,
  movimiento_id INT REFERENCES movimientos_stock(id) ON DELETE CASCADE,  -- compras
  fecha_reporte DATE REFERENCES reportes_venta(fecha) ON DELETE CASCADE   -- bono empleado
);

CREATE TABLE IF NOT EXISTS config_historial (
  id             SERIAL PRIMARY KEY,
  clave          TEXT NOT NULL CHECK (clave IN ('arriendo_mensual', 'base_empleado_quincena', 'bono_por_unidad')),
  valor          NUMERIC NOT NULL,
  vigente_desde  DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS quincenas (
  id      SERIAL PRIMARY KEY,
  inicio  DATE NOT NULL,
  fin     DATE NOT NULL,
  saldo   INT NOT NULL
);

-- RLS -------------------------------------------------------------

ALTER TABLE insumos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE recetas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE reportes_venta   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_detalle   ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_historial ENABLE ROW LEVEL SECURITY;
ALTER TABLE quincenas        ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "solo_autenticado" ON insumos;
DROP POLICY IF EXISTS "solo_autenticado" ON productos;
DROP POLICY IF EXISTS "solo_autenticado" ON recetas;
DROP POLICY IF EXISTS "solo_autenticado" ON reportes_venta;
DROP POLICY IF EXISTS "solo_autenticado" ON ventas_detalle;
DROP POLICY IF EXISTS "solo_autenticado" ON movimientos_stock;
DROP POLICY IF EXISTS "solo_autenticado" ON gastos;
DROP POLICY IF EXISTS "solo_autenticado" ON config_historial;
DROP POLICY IF EXISTS "solo_autenticado" ON quincenas;

CREATE POLICY "solo_autenticado" ON insumos          FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "solo_autenticado" ON productos        FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "solo_autenticado" ON recetas          FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "solo_autenticado" ON reportes_venta   FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "solo_autenticado" ON ventas_detalle   FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "solo_autenticado" ON movimientos_stock FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "solo_autenticado" ON gastos           FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "solo_autenticado" ON config_historial FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "solo_autenticado" ON quincenas        FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- DATOS INICIALES -------------------------------------------------

-- Insumos CON descuento automático por receta
INSERT INTO insumos (nombre, unidad, descuento_auto) VALUES
  ('Pan',      'unidad',  true),
  ('Salchicha','unidad',  true),
  ('Queso',    'porción', true),
  ('Empaque',  'unidad',  true),
  ('Gaseosa',  'unidad',  true),
  ('Carne CA', 'porción', true),
  ('Carne CE', 'porción', true),
  ('Carne PO', 'porción', true),
  ('Birria',   'porción', true),
  ('Tostacos', 'paquete', true),
  ('Doritos',  'paquete', true)
ON CONFLICT (nombre) DO NOTHING;

-- Insumos SIN descuento automático (solo compras y ajustes manuales)
INSERT INTO insumos (nombre, unidad, descuento_auto) VALUES
  ('Salsas',   'unidad', false),
  ('Toppings', 'unidad', false),
  ('Papas',    'unidad', false),
  ('Aseo',     'unidad', false)
ON CONFLICT (nombre) DO NOTHING;

-- Productos (claves del formato G1)
INSERT INTO productos (clave, nombre) VALUES
  ('perro',    'Perro caliente'),
  ('gaseosa',  'Gaseosa suelta'),
  ('adic_CA',  'Adicional carne y maíz'),
  ('adic_CE',  'Adicional cerdo y piña'),
  ('adic_PO',  'Adicional pollo y tocineta'),
  ('snack_TO', 'Tostiloco'),
  ('snack_DO', 'Doriloko')
ON CONFLICT (clave) DO NOTHING;

-- Recetas: perro caliente
INSERT INTO recetas (producto, insumo_id, cantidad)
SELECT 'perro', id, 1 FROM insumos WHERE nombre = 'Pan'      ON CONFLICT DO NOTHING;
INSERT INTO recetas (producto, insumo_id, cantidad)
SELECT 'perro', id, 1 FROM insumos WHERE nombre = 'Salchicha' ON CONFLICT DO NOTHING;
INSERT INTO recetas (producto, insumo_id, cantidad)
SELECT 'perro', id, 1 FROM insumos WHERE nombre = 'Queso'    ON CONFLICT DO NOTHING;
INSERT INTO recetas (producto, insumo_id, cantidad)
SELECT 'perro', id, 1 FROM insumos WHERE nombre = 'Empaque'  ON CONFLICT DO NOTHING;

-- Recetas: gaseosa suelta
INSERT INTO recetas (producto, insumo_id, cantidad)
SELECT 'gaseosa', id, 1 FROM insumos WHERE nombre = 'Gaseosa' ON CONFLICT DO NOTHING;

-- Recetas: adicionales (1 porción de carne por unidad)
INSERT INTO recetas (producto, insumo_id, cantidad)
SELECT 'adic_CA', id, 1 FROM insumos WHERE nombre = 'Carne CA' ON CONFLICT DO NOTHING;
INSERT INTO recetas (producto, insumo_id, cantidad)
SELECT 'adic_CE', id, 1 FROM insumos WHERE nombre = 'Carne CE' ON CONFLICT DO NOTHING;
INSERT INTO recetas (producto, insumo_id, cantidad)
SELECT 'adic_PO', id, 1 FROM insumos WHERE nombre = 'Carne PO' ON CONFLICT DO NOTHING;

-- Recetas: Tostiloco
INSERT INTO recetas (producto, insumo_id, cantidad)
SELECT 'snack_TO', id, 1 FROM insumos WHERE nombre = 'Queso'   ON CONFLICT DO NOTHING;
INSERT INTO recetas (producto, insumo_id, cantidad)
SELECT 'snack_TO', id, 1 FROM insumos WHERE nombre = 'Birria'  ON CONFLICT DO NOTHING;
INSERT INTO recetas (producto, insumo_id, cantidad)
SELECT 'snack_TO', id, 1 FROM insumos WHERE nombre = 'Tostacos' ON CONFLICT DO NOTHING;

-- Recetas: Doriloko
INSERT INTO recetas (producto, insumo_id, cantidad)
SELECT 'snack_DO', id, 1 FROM insumos WHERE nombre = 'Queso'  ON CONFLICT DO NOTHING;
INSERT INTO recetas (producto, insumo_id, cantidad)
SELECT 'snack_DO', id, 1 FROM insumos WHERE nombre = 'Birria' ON CONFLICT DO NOTHING;
INSERT INTO recetas (producto, insumo_id, cantidad)
SELECT 'snack_DO', id, 1 FROM insumos WHERE nombre = 'Doritos' ON CONFLICT DO NOTHING;

-- Nota: el descuento de gaseosa por combo (combos_total × 1 gaseosa) se aplica
-- en la RPC de guardado de venta (Fase 2) porque "combo" es una bandera de item,
-- no un producto independiente del catálogo.

-- Configuración inicial
INSERT INTO config_historial (clave, valor, vigente_desde) VALUES
  ('arriendo_mensual',       700000, '2026-01-01'),
  ('base_empleado_quincena', 400000, '2026-01-01'),
  ('bono_por_unidad',          1000, '2026-01-01');
