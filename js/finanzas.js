  /* ============================================================
     FASE 4: FINANZAS
     ============================================================ */
  function quinceActual(){
    const hoy   = new Date(new Date().toLocaleDateString('en-CA',
                    { timeZone: 'America/Bogota' }));
    const y = hoy.getFullYear(), m = hoy.getMonth(), d = hoy.getDate();
    const ini = d <= 15
      ? new Date(y, m, 1)
      : new Date(y, m, 16);
    const fin = d <= 15
      ? new Date(y, m, 15)
      : new Date(y, m + 1, 0);
    const fmt = x => x.toLocaleDateString('en-CA');
    return { inicio: fmt(ini), fin: fmt(fin) };
  }

  async function cargarFinanzas(){
    // Poner fechas por defecto si están vacías
    const elIni = document.getElementById('fin-inicio');
    const elFin = document.getElementById('fin-fin');
    if(!elIni.value){
      const q = quinceActual();
      elIni.value = q.inicio;
      elFin.value = q.fin;
    }
    await Promise.all([ calcularResumen(), cargarHistorialQuincenas() ]);
  }

  async function calcularResumen(){
    const inicio = document.getElementById('fin-inicio').value;
    const fin    = document.getElementById('fin-fin').value;
    if(!inicio || !fin || inicio > fin) return;

    const panel = document.getElementById('resumen-panel');
    ocultarError('error-fin');

    try {
      // Datos en paralelo
      const [cfgRes, ventasRes, gastosRes, cerradaRes] = await Promise.all([
        db.from('config_historial')
          .select('clave,valor,vigente_desde')
          .lte('vigente_desde', fin)
          .order('vigente_desde', { ascending: false }),
        db.from('reportes_venta')
          .select('total,perros,tostilocos,dorilokos')
          .gte('fecha', inicio).lte('fecha', fin),
        db.from('gastos')
          .select('categoria,valor')
          .gte('fecha', inicio).lte('fecha', fin),
        db.from('quincenas')
          .select('saldo').eq('inicio', inicio).eq('fin', fin).maybeSingle()
      ]);

      // Config
      const cfg = {};
      cfgRes.data?.forEach(r => { if(!(r.clave in cfg)) cfg[r.clave] = +r.valor; });
      const arriendo = (cfg.arriendo_mensual    || 700000) / 2;
      const base     =  cfg.base_empleado_quincena || 400000;
      const bonoUnit =  cfg.bono_por_unidad     || 1000;

      // Ventas
      const ventas    = ventasRes.data || [];
      const ingresos  = ventas.reduce((s, r) => s + r.total, 0);
      const unidades  = ventas.reduce((s, r) => s + r.perros + r.tostilocos + r.dorilokos, 0);
      const dias      = ventas.length;

      // Gastos ya en DB para el período
      const gastos = gastosRes.data || [];
      const gasInv = gastos.filter(g => g.categoria === 'inventario').reduce((s,g) => s+g.valor, 0);
      const gasImp = gastos.filter(g => g.categoria === 'imprevisto').reduce((s,g) => s+g.valor, 0);

      const bono   = unidades * bonoUnit;
      const saldo  = ingresos - gasInv - gasImp - arriendo - base - bono;

      // Render
      document.getElementById('fin-dias').textContent      = dias;
      document.getElementById('fin-unidades').textContent  = unidades;
      document.getElementById('fin-ingresos').textContent  = fmt(ingresos);
      document.getElementById('fin-inv').textContent       = fmt(gasInv);
      document.getElementById('fin-arriendo').textContent  = fmt(arriendo);
      document.getElementById('fin-base').textContent      = fmt(base);
      document.getElementById('fin-bono').textContent      = fmt(bono) +
        ' (' + unidades + ' × ' + fmt(bonoUnit) + ')';
      const impRow = document.getElementById('fin-imp-row');
      impRow.hidden = gasImp === 0;
      if(gasImp) document.getElementById('fin-imp').textContent = fmt(gasImp);

      const elSaldo = document.getElementById('fin-saldo');
      elSaldo.textContent = fmt(saldo);
      elSaldo.className = 'fin-saldo ' + (saldo >= 0 ? 'pos' : 'neg');

      // Estado del botón cerrar
      const cerrada = !!cerradaRes.data;
      document.getElementById('btn-cerrar').disabled = cerrada;
      document.getElementById('fin-ya-cerrada').hidden = !cerrada;

      panel.hidden = false;
    } catch(e){
      mostrarError('error-fin', 'Error calculando el resumen: ' + (e.message || ''));
    }
  }

  async function cerrarQuincena(){
    const inicio = document.getElementById('fin-inicio').value;
    const fin    = document.getElementById('fin-fin').value;
    if(!inicio || !fin) return;
    const btn = document.getElementById('btn-cerrar');
    btn.disabled = true; btn.textContent = 'Cerrando…';
    ocultarError('error-fin');
    const { data, error } = await db.rpc('cerrar_quincena',
      { p_inicio: inicio, p_fin: fin });
    btn.textContent = 'Cerrar quincena';
    if(error){
      btn.disabled = false;
      mostrarError('error-fin', 'Error: ' + error.message);
      return;
    }
    document.getElementById('fin-ya-cerrada').hidden = false;
    await Promise.all([ calcularResumen(), cargarHistorialQuincenas() ]);
  }

  async function registrarImprevisto(){
    const concepto = document.getElementById('imp-concepto').value.trim();
    const valor    = parseInt(document.getElementById('imp-valor').value);
    if(!concepto || !(valor > 0)){
      mostrarError('error-fin', 'Ingresa concepto y valor del imprevisto.');
      return;
    }
    const btn = document.getElementById('btn-imprevisto');
    btn.disabled = true; btn.textContent = 'Guardando…';
    ocultarError('error-fin');
    const fecha = document.getElementById('fin-fin').value
               || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    const { error } = await db.from('gastos').insert(
      { fecha, categoria: 'imprevisto', concepto, valor }
    );
    btn.disabled = false; btn.textContent = 'Registrar imprevisto';
    if(error){ mostrarError('error-fin', 'Error: ' + error.message); return; }
    document.getElementById('imp-concepto').value = '';
    document.getElementById('imp-valor').value    = '';
    calcularResumen();
    cargarImprevistos();
  }

  async function cargarHistorialQuincenas(){
    const { data } = await db.from('quincenas')
      .select('inicio,fin,saldo')
      .order('inicio', { ascending: false })
      .limit(8);
    const panel = document.getElementById('hist-q-panel');
    if(!data?.length){ panel.hidden = true; return; }
    const maxAbs = Math.max(...data.map(q => Math.abs(q.saldo)), 1);
    document.getElementById('hist-q-lista').innerHTML = data.map(q => {
      const pct   = Math.round(Math.abs(q.saldo) / maxAbs * 100);
      const pos   = q.saldo >= 0;
      const label = q.inicio.slice(5).replace('-','/') + ' – ' + q.fin.slice(5).replace('-','/');
      return '<div class="q-row">' +
        '<div class="q-head">' +
          '<span class="q-period">' + label + '</span>' +
          '<span class="' + (pos ? 'q-ok' : 'q-bad') + '">' + fmt(q.saldo) + '</span>' +
          '<button class="q-del" data-inicio="' + q.inicio + '" data-fin="' + q.fin + '">Borrar</button>' +
        '</div>' +
        '<div class="q-track">' +
          '<div class="' + (pos ? 'q-bar-pos' : 'q-bar-neg') + '" style="width:' + pct + '%"></div>' +
        '</div>' +
      '</div>';
    }).join('');
    panel.hidden = false;
    document.getElementById('hist-q-lista').querySelectorAll('.q-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        const inicio = btn.dataset.inicio;
        const fin    = btn.dataset.fin;
        const label  = inicio.slice(5).replace('-','/') + ' – ' + fin.slice(5).replace('-','/');
        if(!confirm('¿Eliminar la quincena ' + label + '?\n\nSe borrarán también los gastos de arriendo, base y bono registrados al cierre.')) return;
        btn.disabled = true;
        const { error: e1 } = await db.from('gastos')
          .delete().eq('fecha', fin)
          .in('categoria', ['arriendo', 'empleado_base', 'empleado_bono']);
        if(e1){ alert('Error al eliminar gastos: ' + e1.message); btn.disabled = false; return; }
        const { error: e2 } = await db.from('quincenas')
          .delete().eq('inicio', inicio).eq('fin', fin);
        if(e2){ alert('Error al eliminar quincena: ' + e2.message); btn.disabled = false; return; }
        calcularResumen();
        cargarHistorialQuincenas();
      });
    });
  }

  document.getElementById('btn-calcular').addEventListener('click',  calcularResumen);
  document.getElementById('btn-cerrar').addEventListener('click',    cerrarQuincena);
  document.getElementById('btn-imprevisto').addEventListener('click', registrarImprevisto);

