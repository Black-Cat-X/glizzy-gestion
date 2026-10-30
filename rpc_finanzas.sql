-- =============================================================
-- Glizzy Gestión — Fase 4: Finanzas
-- Ejecutar en Supabase > SQL Editor
-- =============================================================

-- RPC cerrar_quincena: registra gastos de cierre y guarda el saldo
CREATE OR REPLACE FUNCTION cerrar_quincena(
  p_inicio DATE,
  p_fin    DATE
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_arriendo   NUMERIC;
  v_base       NUMERIC;
  v_bono_unit  NUMERIC;
  v_unidades   INT;
  v_ingresos   NUMERIC;
  v_gas_inv    NUMERIC;
  v_gas_imp    NUMERIC;
  v_bono       NUMERIC;
  v_saldo      NUMERIC;
BEGIN
  IF EXISTS (SELECT 1 FROM quincenas WHERE inicio = p_inicio AND fin = p_fin) THEN
    RAISE EXCEPTION 'Esta quincena ya fue cerrada.';
  END IF;

  -- Config vigente al cierre
  SELECT valor INTO v_arriendo FROM config_historial
    WHERE clave = 'arriendo_mensual'       AND vigente_desde <= p_fin
    ORDER BY vigente_desde DESC LIMIT 1;
  SELECT valor INTO v_base FROM config_historial
    WHERE clave = 'base_empleado_quincena' AND vigente_desde <= p_fin
    ORDER BY vigente_desde DESC LIMIT 1;
  SELECT valor INTO v_bono_unit FROM config_historial
    WHERE clave = 'bono_por_unidad'        AND vigente_desde <= p_fin
    ORDER BY vigente_desde DESC LIMIT 1;

  -- Ingresos y unidades del período
  SELECT COALESCE(SUM(total), 0),
         COALESCE(SUM(perros + tostilocos + dorilokos), 0)
    INTO v_ingresos, v_unidades
    FROM reportes_venta
    WHERE fecha BETWEEN p_inicio AND p_fin;

  -- Gastos ya registrados en el período (inventario e imprevistos)
  SELECT COALESCE(SUM(valor) FILTER (WHERE categoria = 'inventario'), 0),
         COALESCE(SUM(valor) FILTER (WHERE categoria = 'imprevisto'), 0)
    INTO v_gas_inv, v_gas_imp
    FROM gastos
    WHERE fecha BETWEEN p_inicio AND p_fin;

  v_bono := v_unidades * COALESCE(v_bono_unit, 1000);

  -- Gastos de cierre
  INSERT INTO gastos (fecha, categoria, concepto, valor)
  VALUES (p_fin, 'arriendo',       'Arriendo quincena',
          ((v_arriendo) / 2)::INT);
  INSERT INTO gastos (fecha, categoria, concepto, valor)
  VALUES (p_fin, 'empleado_base',  'Base empleado',
          v_base::INT);
  INSERT INTO gastos (fecha, categoria, concepto, valor)
  VALUES (p_fin, 'empleado_bono',
          'Bono empleado (' || v_unidades || ' unidades)',
          v_bono::INT);

  v_saldo := v_ingresos - v_gas_inv - v_gas_imp
             - (v_arriendo / 2) - v_base - v_bono;

  INSERT INTO quincenas (inicio, fin, saldo)
  VALUES (p_inicio, p_fin, v_saldo::INT);

  RETURN jsonb_build_object(
    'ingresos',   v_ingresos,
    'gas_inv',    v_gas_inv,
    'gas_imp',    v_gas_imp,
    'arriendo',   v_arriendo / 2,
    'base',       v_base,
    'bono',       v_bono,
    'unidades',   v_unidades,
    'saldo',      v_saldo
  );
END;
$$;

GRANT EXECUTE ON FUNCTION cerrar_quincena(DATE, DATE) TO authenticated;
