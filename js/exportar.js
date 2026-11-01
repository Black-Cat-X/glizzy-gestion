  /* ============================================================
     FASE 5: EXPORTAR
     ============================================================ */
  document.getElementById('exp-rango').addEventListener('change', function(){
    document.getElementById('exp-custom').hidden = this.value !== 'custom';
  });

  async function exportarJSON(){
    const rango = document.getElementById('exp-rango').value;
    let inicio = null, fin = null;

    if(rango === 'quincena'){
      const q = quinceActual();
      inicio = q.inicio; fin = q.fin;
    } else if(rango === 'custom'){
      inicio = document.getElementById('exp-inicio').value;
      fin    = document.getElementById('exp-fin').value;
      if(!inicio || !fin || inicio > fin){
        mostrarError('error-exp', 'Selecciona un rango de fechas válido.');
        return;
      }
    }

    const btn = document.getElementById('btn-exportar');
    btn.disabled = true; btn.textContent = 'Generando…';
    ocultarError('error-exp');
    document.getElementById('exp-ok').hidden = true;

    try {
      // Construir queries (con o sin filtro de fechas)
      const rng = q => inicio ? q.gte('fecha', inicio).lte('fecha', fin) : q;
      const rngQ = q => inicio ? q.gte('fecha_reporte', inicio).lte('fecha_reporte', fin) : q;

      const [r1, r2, r3, r4, r5] = await Promise.all([
        rng(db.from('reportes_venta')
          .select('fecha,vendedor,firma,num_ventas,perros,combos,gaseosas_sueltas,adic_ca,adic_ce,adic_po,tostilocos,dorilokos,efectivo,transferencia,total,cuadra,created_at')
          .order('fecha', { ascending: true })),
        rngQ(db.from('ventas_detalle')
          .select('fecha_reporte,hora,total,metodo,items')
          .order('fecha_reporte', { ascending: true })),
        rng(db.from('gastos')
          .select('fecha,categoria,concepto,valor')
          .order('fecha', { ascending: true })),
        (inicio
          ? db.from('quincenas').select('inicio,fin,saldo')
              .gte('inicio', inicio).lte('fin', fin)
              .order('inicio', { ascending: true })
          : db.from('quincenas').select('inicio,fin,saldo')
              .order('inicio', { ascending: true })),
        db.from('config_historial')
          .select('clave,valor,vigente_desde')
          .order('vigente_desde', { ascending: true })
      ]);

      if(r1.error) throw r1.error;
      if(r2.error) throw r2.error;

      // Agrupar detalle por fecha
      const detPorFecha = {};
      (r2.data || []).forEach(d => {
        (detPorFecha[d.fecha_reporte] ||= []).push({
          hora:   d.hora.slice(0,2) + ':' + d.hora.slice(2,4),
          total:  d.total,
          metodo: d.metodo === 0 ? 'efectivo' : 'transferencia',
          items:  d.items
        });
      });

      const ahora = new Date().toLocaleString('es-CO',
        { timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'short' });

      const exportData = {
        exportado: ahora,
        rango:     inicio ? (inicio + ' al ' + fin) : 'todo el historial',
        reportes:  (r1.data || []).map(r => ({
          fecha:            r.fecha,
          vendedor:         r.vendedor,
          firma:            r.firma,
          num_ventas:       r.num_ventas,
          perros:           r.perros,
          combos:           r.combos,
          gaseosas_sueltas: r.gaseosas_sueltas,
          adic_ca:          r.adic_ca,
          adic_ce:          r.adic_ce,
          adic_po:          r.adic_po,
          tostilocos:       r.tostilocos,
          dorilokos:        r.dorilokos,
          efectivo:         r.efectivo,
          transferencia:    r.transferencia,
          total:            r.total,
          cuadra:           r.cuadra,
          ventas:           detPorFecha[r.fecha] || []
        })),
        gastos:    r3.data || [],
        quincenas: r4.data || [],
        config:    r5.data || []
      };

      const json  = JSON.stringify(exportData, null, 2);
      const blob  = new Blob([json], { type: 'application/json' });
      const url   = URL.createObjectURL(blob);
      const a     = document.createElement('a');
      const stamp = new Date().toLocaleDateString('en-CA',
                    { timeZone: 'America/Bogota' });
      a.href     = url;
      a.download = 'glizzy-' + stamp + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const nr = exportData.reportes.length;
      const ng = exportData.gastos.length;
      const el = document.getElementById('exp-ok');
      el.textContent = '✓ ' + nr + ' reporte' + (nr !== 1 ? 's' : '') +
                       ' · ' + ng + ' gasto' + (ng !== 1 ? 's' : '') +
                       ' · ' + exportData.quincenas.length + ' quincenas';
      el.hidden = false;

    } catch(e){
      mostrarError('error-exp', 'Error al exportar: ' + (e.message || 'error desconocido'));
    } finally {
      btn.disabled = false; btn.textContent = 'Descargar JSON';
    }
  }


  /* ============================================================
     FASE 6: GRÁFICAS
     ============================================================ */

  function _niceStep(rough){
    const pow = Math.pow(10, Math.floor(Math.log10(Math.abs(rough) || 1)));
    const n = rough / pow;
    return n < 1.5 ? pow : n < 3.5 ? 2*pow : n < 7.5 ? 5*pow : 10*pow;
  }
  function _fmtK(v){
    if(Math.abs(v) >= 1e6) return (v/1e6).toFixed(1)+'M';
    if(Math.abs(v) >= 1e3) return Math.round(v/1e3)+'K';
    return String(Math.round(v));
  }
  function _svgYAxis(ML, MT, CH, padMin, padMax){
    const range = padMax - padMin || 1;
    const step  = _niceStep((padMax - padMin) / 4);
    let out = '';
    for(let t = Math.ceil(padMin/step)*step; t <= padMax + step*0.01; t += step){
      const y = (MT + CH*(padMax - t)/range).toFixed(1);
      out += '<line x1="'+ML+'" y1="'+y+'" x2="'+(ML+272)+'" y2="'+y+'" stroke="#2e2318" stroke-width="1"/>';
      out += '<text x="'+(ML-4)+'" y="'+(+y+4).toFixed(1)+'" text-anchor="end" font-size="9" fill="#6b5d4a">'+_fmtK(t)+'</text>';
    }
    return out;
  }

  let g3Data = null;

  async function cargarGraficas(){
    await Promise.all([ grafica1(), grafica2(), grafica3(), grafica4(), grafica5(), grafica6() ]);
  }

  /* ── Gráfica 1: Saldo por quincena ───────────────────────────────────── */
  async function grafica1(){
    const box = document.getElementById('g1-contenedor');
    if(!box) return;
    const { data } = await db.from('quincenas').select('inicio,fin,saldo')
      .order('inicio', { ascending: true }).limit(12);
    if(!data?.length){ box.innerHTML = '<p class="graf-vacio">Sin quincenas cerradas aún.</p>'; return; }

    const W=340, H=185, ML=58, MR=10, MT=15, MB=50;
    const CW=W-ML-MR, CH=H-MT-MB, N=data.length, GAP=3;
    const bw = (CW - GAP*(N-1)) / N;

    const minVal = Math.min(...data.map(q=>q.saldo), 0);
    const maxVal = Math.max(...data.map(q=>q.saldo), 0);
    const padMin = minVal < 0 ? minVal*1.15 : 0;
    const padMax = maxVal > 0 ? maxVal*1.15 : 1;
    const range  = padMax - padMin;
    const toY    = v => MT + CH*(padMax-v)/range;
    const zeroY  = toY(0);

    let s = '<svg viewBox="0 0 '+W+' '+H+'" width="100%" style="display:block">';
    s += _svgYAxis(ML, MT, CH, padMin, padMax);
    if(minVal < 0)
      s += '<line x1="'+ML+'" y1="'+zeroY.toFixed(1)+'" x2="'+(ML+CW)+'" y2="'+zeroY.toFixed(1)+'" stroke="#4a3d2e" stroke-width="1.5"/>';

    data.forEach((q,i) => {
      const x  = ML + i*(bw+GAP);
      const y  = q.saldo >= 0 ? toY(q.saldo) : zeroY;
      const bh = Math.max(Math.abs(toY(q.saldo)-zeroY), 1);
      const c  = q.saldo >= 0 ? '#6fcf97' : '#eb5757';
      s += '<rect x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+bh.toFixed(1)+'" fill="'+c+'" rx="2"/>';
      const lx = (x+bw/2).toFixed(1);
      const ly = (MT+CH+14);
      const lbl = q.inicio.slice(8)+'/'+q.inicio.slice(5,7);
      s += '<text x="'+lx+'" y="'+ly+'" text-anchor="end" font-size="9" fill="#9c8f79" transform="rotate(-40,'+lx+','+ly+')">'+lbl+'</text>';
    });
    s += '<line x1="'+ML+'" y1="'+MT+'" x2="'+ML+'" y2="'+(MT+CH)+'" stroke="#4a3d2e" stroke-width="1"/>';
    s += '<line x1="'+ML+'" y1="'+(MT+CH)+'" x2="'+(ML+CW)+'" y2="'+(MT+CH)+'" stroke="#4a3d2e" stroke-width="1"/>';
    s += '</svg>';
    box.innerHTML = s;
  }

  /* ── Gráfica 2: Ingresos vs Gastos por quincena ─────────────────────── */
  async function grafica2(){
    const box = document.getElementById('g2-contenedor');
    const leyBox = document.getElementById('g2-leyenda');
    if(!box) return;

    const [qr, rvr, gr] = await Promise.all([
      db.from('quincenas').select('inicio,fin').order('inicio', { ascending: true }).limit(12),
      db.from('reportes_venta').select('fecha,total'),
      db.from('gastos').select('fecha,categoria,valor')
        .in('categoria', ['inventario','arriendo','empleado_base','empleado_bono','imprevisto'])
    ]);
    if(!qr.data?.length){ box.innerHTML = '<p class="graf-vacio">Sin quincenas cerradas aún.</p>'; return; }

    const CATS  = ['inventario','arriendo','empleado_base','empleado_bono','imprevisto'];
    const CNAME = { inventario:'Inventario', arriendo:'Arriendo',
                    empleado_base:'Base empl.', empleado_bono:'Bono empl.', imprevisto:'Imprevisto' };
    const CCOL  = { inventario:'#e2a03f', arriendo:'#5498e4',
                    empleado_base:'#9b8ef8', empleado_bono:'#c084fc', imprevisto:'#eb5757' };

    const series = qr.data.map(q => {
      const ing = (rvr.data||[]).filter(r => r.fecha >= q.inicio && r.fecha <= q.fin)
                                 .reduce((s,r) => s+r.total, 0);
      const catMap = {};
      CATS.forEach(c => {
        catMap[c] = (gr.data||[]).filter(g => g.fecha >= q.inicio && g.fecha <= q.fin && g.categoria === c)
                                  .reduce((s,g) => s+g.valor, 0);
      });
      return { q, ing, catMap };
    });

    const maxVal = Math.max(...series.map(s => s.ing), 1);
    const padMax = maxVal * 1.1;

    const W=340, H=175, ML=58, MR=10, MT=15, MB=45;
    const CW=W-ML-MR, CH=H-MT-MB, N=series.length, PAIR=2, GAP_IN=2, GAP_OUT=5;
    const pairW = (CW - GAP_OUT*(N-1)) / N;
    const bw = (pairW - GAP_IN) / PAIR;
    const toY = v => MT + CH*(padMax-v)/padMax;

    let s = '<svg viewBox="0 0 '+W+' '+H+'" width="100%" style="display:block">';
    s += _svgYAxis(ML, MT, CH, 0, padMax);

    series.forEach((d, i) => {
      const pairX = ML + i*(pairW+GAP_OUT);
      // Barra izquierda: ingresos
      const ingH = Math.max((d.ing/padMax)*CH, 1);
      s += '<rect x="'+pairX.toFixed(1)+'" y="'+(MT+CH-ingH).toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+ingH.toFixed(1)+'" fill="#6fcf97" rx="2"/>';
      // Barra derecha: gastos apilados
      let stackY = MT+CH;
      CATS.forEach(c => {
        const v = d.catMap[c] || 0;
        if(v <= 0) return;
        const h = Math.max((v/padMax)*CH, 1);
        stackY -= h;
        s += '<rect x="'+(pairX+bw+GAP_IN).toFixed(1)+'" y="'+stackY.toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+h.toFixed(1)+'" fill="'+CCOL[c]+'" rx="1"/>';
      });
      // Etiqueta X
      const lx = (pairX+pairW/2).toFixed(1);
      const ly = MT+CH+14;
      const lbl = d.q.inicio.slice(8)+'/'+d.q.inicio.slice(5,7);
      s += '<text x="'+lx+'" y="'+ly+'" text-anchor="end" font-size="9" fill="#9c8f79" transform="rotate(-40,'+lx+','+ly+')">'+lbl+'</text>';
    });
    s += '<line x1="'+ML+'" y1="'+MT+'" x2="'+ML+'" y2="'+(MT+CH)+'" stroke="#4a3d2e" stroke-width="1"/>';
    s += '<line x1="'+ML+'" y1="'+(MT+CH)+'" x2="'+(ML+CW)+'" y2="'+(MT+CH)+'" stroke="#4a3d2e" stroke-width="1"/>';
    s += '</svg>';
    box.innerHTML = s;

    // Leyenda
    const items = [{ label:'Ingresos', col:'#6fcf97' }]
      .concat(CATS.map(c => ({ label: CNAME[c], col: CCOL[c] })));
    leyBox.innerHTML = items.map(it =>
      '<span class="graf-ley-item"><span class="graf-dot" style="background:'+it.col+'"></span>'+it.label+'</span>'
    ).join('');
  }

  /* ── Gráfica 3: Evolución precio insumos ────────────────────────────── */
  const G3_COLS = ['#e2a03f','#6fcf97','#5498e4','#9b8ef8','#eb5757',
                   '#f7c59f','#74b9ff','#a29bfe','#fd79a8','#55efc4','#ffeaa7'];

  async function grafica3(){
    const box = document.getElementById('g3-contenedor');
    const filtros = document.getElementById('g3-filtros');
    if(!box) return;
    if(!g3Data){
      const { data } = await db.from('movimientos_stock')
        .select('fecha,costo_unitario,insumos(nombre)')
        .eq('tipo', 'compra')
        .not('costo_unitario', 'is', null)
        .order('fecha', { ascending: true });
      g3Data = data || [];
    }
    if(!g3Data.length){ box.innerHTML = '<p class="graf-vacio">Sin compras registradas aún.</p>'; return; }

    // Agrupar por insumo
    const insumoMap = {};
    g3Data.forEach(m => {
      const nombre = m.insumos?.nombre || ('id'+m.insumo_id);
      if(!insumoMap[nombre]) insumoMap[nombre] = [];
      insumoMap[nombre].push({ fecha: m.fecha, costo: m.costo_unitario });
    });
    const insumos = Object.keys(insumoMap).sort();

    // Filtros (checkboxes) — solo crear si no existen ya
    if(!filtros.hasChildNodes()){
      insumos.forEach((nombre, idx) => {
        const col = G3_COLS[idx % G3_COLS.length];
        const id  = 'g3c_' + idx;
        const lbl = document.createElement('label');
        lbl.className = 'g3-chk';
        lbl.innerHTML = '<input type="checkbox" id="'+id+'" checked>' +
          '<span class="graf-dot" style="background:'+col+'"></span>' + nombre;
        lbl.querySelector('input').addEventListener('change', () => _g3Render(insumos, insumoMap));
        filtros.appendChild(lbl);
      });
    }
    _g3Render(insumos, insumoMap);
  }

  function _g3Render(insumos, insumoMap){
    const box = document.getElementById('g3-contenedor');
    const activos = insumos.filter((_,i) => {
      const el = document.getElementById('g3c_'+i);
      return el ? el.checked : true;
    });
    if(!activos.length){ box.innerHTML = '<p class="graf-vacio">Selecciona al menos un insumo.</p>'; return; }

    const allPts = activos.flatMap(n => insumoMap[n]);
    const fechas  = [...new Set(allPts.map(p => p.fecha))].sort();
    const maxCost = Math.max(...allPts.map(p => p.costo), 1);
    const padMax  = maxCost * 1.15;

    const W=340, H=180, ML=58, MR=10, MT=12, MB=35;
    const CW=W-ML-MR, CH=H-MT-MB;
    const NF = fechas.length;
    const toX = i  => ML + (NF < 2 ? CW/2 : i*(CW/(NF-1)));
    const toY = v  => MT + CH*(padMax-v)/padMax;

    let s = '<svg viewBox="0 0 '+W+' '+H+'" width="100%" style="display:block">';
    s += _svgYAxis(ML, MT, CH, 0, padMax);

    // X ticks (máx 6 etiquetas)
    const step = Math.max(1, Math.floor(NF/6));
    for(let i=0; i<NF; i+=step){
      const x = toX(i).toFixed(1);
      const lbl = fechas[i].slice(8)+'/'+fechas[i].slice(5,7);
      s += '<text x="'+x+'" y="'+(MT+CH+14)+'" text-anchor="end" font-size="9" fill="#9c8f79" transform="rotate(-40,'+x+','+(MT+CH+14)+')">'+lbl+'</text>';
    }

    activos.forEach(nombre => {
      const idx = insumos.indexOf(nombre);
      const col = G3_COLS[idx % G3_COLS.length];
      const pts = insumoMap[nombre];
      if(pts.length === 0) return;
      // Construir path
      let d = '';
      pts.forEach((p, pi) => {
        const fi = fechas.indexOf(p.fecha);
        const x = toX(fi).toFixed(1);
        const y = toY(p.costo).toFixed(1);
        d += (pi === 0 ? 'M' : 'L') + x + ' ' + y + ' ';
      });
      s += '<path d="'+d.trim()+'" stroke="'+col+'" stroke-width="2" fill="none" stroke-linejoin="round" stroke-linecap="round"/>';
      // Puntos
      pts.forEach(p => {
        const fi = fechas.indexOf(p.fecha);
        s += '<circle cx="'+toX(fi).toFixed(1)+'" cy="'+toY(p.costo).toFixed(1)+'" r="3" fill="'+col+'"/>';
        s += '<title>'+nombre+' '+p.fecha+': $'+_fmtK(p.costo)+'</title>';
      });
    });

    s += '<line x1="'+ML+'" y1="'+MT+'" x2="'+ML+'" y2="'+(MT+CH)+'" stroke="#4a3d2e" stroke-width="1"/>';
    s += '<line x1="'+ML+'" y1="'+(MT+CH)+'" x2="'+(ML+CW)+'" y2="'+(MT+CH)+'" stroke="#4a3d2e" stroke-width="1"/>';
    s += '</svg>';
    box.innerHTML = s;
  }

  document.getElementById('btn-exportar').addEventListener('click', exportarJSON);

