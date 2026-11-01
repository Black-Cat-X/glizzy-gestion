-- =============================================================
-- Glizzy Gestión — RPC Fase 2: guardar_venta
-- Ejecutar en Supabase > SQL Editor
-- =============================================================

CREATE OR REPLACE FUNCTION guardar_venta(
  p_fecha             DATE,
  p_vendedor          TEXT,
  p_firma             TEXT,
  p_num_ventas        INT,
  p_perros            INT,
  p_combos            INT,
  p_gaseosas_sueltas  INT,
  p_adic_ca           INT,
  p_adic_ce           INT,
  p_adic_po           INT,
  p_tostilocos        INT,
  p_dorilokos         INT,
  p_efectivo          INT,
  p_transferencia     INT,
  p_total             INT,
  p_cuadra            BOOLEAN,
  p_payload           TEXT,
  p_ventas            JSONB
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_venta   RECORD;
  v_insumo  RECORD;
  v_cant    INT;
BEGIN
  -- Evitar duplicados
  IF EXISTS (SELECT 1 FROM reportes_venta WHERE fecha = p_fecha) THEN
    RAISE EXCEPTION 'Ya existe un reporte guardado para la fecha %.', p_fecha
      USING ERRCODE = 'unique_violation';
  END IF;

  -- 1. Reporte principal
  INSERT INTO reportes_venta (
    fecha, vendedor, firma, num_ventas,
    perros, combos, gaseosas_sueltas,
    adic_ca, adic_ce, adic_po,
    tostilocos, dorilokos,
    efectivo, transferencia, total,
    cuadra, payload
  ) VALUES (
    p_fecha, p_vendedor, p_firma, p_num_ventas,
    p_perros, p_combos, p_gaseosas_sueltas,
    p_adic_ca, p_adic_ce, p_adic_po,
    p_tostilocos, p_dorilokos,
    p_efectivo, p_transferencia, p_total,
    p_cuadra, p_payload
  );

  -- 2. Detalle de cada venta
  FOR v_venta IN SELECT value FROM jsonb_array_elements(p_ventas) LOOP
    INSERT INTO ventas_detalle (fecha_reporte, hora, total, metodo, items)
    VALUES (
      p_fecha,
      v_venta.value->>'hhmm',
      (v_venta.value->>'total')::INT,
      (v_venta.value->>'metodo')::INT,
      v_venta.value->'items'
    );
  END LOOP;

  -- 3. Movimientos de stock (descuento automático por insumo)
  --    La gaseosa de combo se descuenta aquí: combos + gaseosas_sueltas
  FOR v_insumo IN
    SELECT id, nombre FROM insumos WHERE descuento_auto = true AND activo = true
  LOOP
    v_cant := CASE v_insumo.nombre
      WHEN 'Pan'       THEN p_perros
      WHEN 'Salchicha' THEN p_perros
      WHEN 'Queso'     THEN p_perros + p_tostilocos + p_dorilokos
      WHEN 'Empaque'   THEN p_perros
      WHEN 'Gaseosa'   THEN p_combos + p_gaseosas_sueltas
      WHEN 'Carne CA'  THEN p_adic_ca
      WHEN 'Carne CE'  THEN p_adic_ce
      WHEN 'Carne PO'  THEN p_adic_po
      WHEN 'Birria'    THEN p_tostilocos + p_dorilokos
      WHEN 'Tostacos'  THEN p_tostilocos
      WHEN 'Doritos'   THEN p_dorilokos
      ELSE 0
    END;

    IF v_cant > 0 THEN
      INSERT INTO movimientos_stock (fecha, insumo_id, tipo, cantidad, fecha_reporte)
      VALUES (p_fecha, v_insumo.id, 'venta', -v_cant, p_fecha);
    END IF;
  END LOOP;
END;
$$;

-- Permitir que usuarios autenticados llamen la función
GRANT EXECUTE ON FUNCTION guardar_venta(
  DATE, TEXT, TEXT, INT, INT, INT, INT, INT, INT, INT, INT, INT, INT, INT, INT, BOOLEAN, TEXT, JSONB
) TO authenticated;
