-- =============================================================
-- Glizzy Gestión — Fase 3: Inventario
-- Ejecutar en Supabase > SQL Editor
-- =============================================================

-- Vista stock actual (suma de movimientos por insumo)
CREATE OR REPLACE VIEW stock_actual AS
SELECT
  i.id,
  i.nombre,
  i.unidad,
  i.minimo_semana_baja,
  i.descuento_auto,
  COALESCE(SUM(m.cantidad), 0) AS stock
FROM insumos i
LEFT JOIN movimientos_stock m ON m.insumo_id = i.id
WHERE i.activo = true
GROUP BY i.id, i.nombre, i.unidad, i.minimo_semana_baja, i.descuento_auto
ORDER BY i.nombre;

ALTER VIEW stock_actual SET (security_invoker = true);
GRANT SELECT ON stock_actual TO authenticated;

-- RPC registrar_compra: inserta movimiento de stock y gasto de inventario
CREATE OR REPLACE FUNCTION registrar_compra(
  p_insumo_id   INT,
  p_cantidad    NUMERIC,
  p_valor_total NUMERIC,
  p_fecha       DATE DEFAULT CURRENT_DATE
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_nombre TEXT;
  v_mov_id INT;
BEGIN
  SELECT nombre INTO v_nombre FROM insumos WHERE id = p_insumo_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insumo % no existe.', p_insumo_id;
  END IF;

  INSERT INTO movimientos_stock (fecha, insumo_id, tipo, cantidad, valor_total, costo_unitario)
  VALUES (p_fecha, p_insumo_id, 'compra', p_cantidad,
          p_valor_total, p_valor_total / NULLIF(p_cantidad, 0))
  RETURNING id INTO v_mov_id;

  INSERT INTO gastos (fecha, categoria, concepto, valor, movimiento_id)
  VALUES (p_fecha, 'inventario', 'Compra: ' || v_nombre, p_valor_total::INT, v_mov_id);
END;
$$;

GRANT EXECUTE ON FUNCTION registrar_compra(INT, NUMERIC, NUMERIC, DATE) TO authenticated;
