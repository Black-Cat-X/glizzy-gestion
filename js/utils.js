  /* ============================================================
     UTILIDADES
     ============================================================ */
  const fmt     = n => '$' + Math.round(n).toLocaleString('es-CO');
  const fmtHora = hhmm => hhmm.slice(0,2) + ':' + hhmm.slice(2,4);
  const esc     = t => String(t).replace(/[&<>"]/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])
  );

  function mostrarError(id, msg){
    const el = document.getElementById(id);
    el.textContent = msg;
    el.style.display = 'block';
  }
  function ocultarError(id){
    const el = document.getElementById(id);
    el.style.display = 'none';
  }






  /* ── Gráfica 4: Composición de ventas por producto ──────────────────── */
  const G4_PRODS = ['perros','combos','tostilocos','dorilokos'];
  const G4_NAME  = { perros:'Perros', combos:'Combos', tostilocos:'Tostilocos', dorilokos:'Dorilokos' };
  const G4_COL   = { perros:'#e2a03f', combos:'#6fcf97', tostilocos:'#5498e4', dorilokos:'#9b8ef8' };

  let rvGrafData = null;

  async function _fetchRV(){
    if(!rvGrafData){
      const { data } = await db.from('reportes_venta')
        .select('fecha,perros,combos,tostilocos,dorilokos,efectivo,transferencia')
        .order('fecha', { ascending: true }).limit(30);
      rvGrafData = data || [];
    }
    return rvGrafData;
  }

  async function grafica4(){
    const box    = document.getElementById('g4-contenedor');
    const leyBox = document.getElementById('g4-leyenda');
    if(!box) return;
    const data = await _fetchRV();
    const d25  = data.slice(-25);
    if(!d25.length){ box.innerHTML = '<p class="graf-vacio">Sin reportes de venta aún.</p>'; return; }

    const W=340, H=180, ML=55, MR=10, MT=15, MB=48;
    const CW=W-ML-MR, CH=H-MT-MB, N=d25.length, GAP=2;
    const bw = (CW - GAP*(N-1)) / N;

    const maxU = Math.max(...d25.map(r => G4_PRODS.reduce((s,p) => s+(r[p]||0), 0)), 1);
    const padMax = maxU * 1.1;
    const toY = v => MT + CH*(padMax-v)/padMax;

    let s = '<svg viewBox="0 0 '+W+' '+H+'" width="100%" style="display:block">';
    s += _svgYAxis(ML, MT, CH, 0, padMax);

    d25.forEach((r, i) => {
      const x = ML + i*(bw+GAP);
      let stackY = MT + CH;
      G4_PRODS.forEach(p => {
        const v = r[p] || 0;
        if(v <= 0) return;
        const h = Math.max((v/padMax)*CH, 1);
        stackY -= h;
        s += '<rect x="'+x.toFixed(1)+'" y="'+stackY.toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+h.toFixed(1)+'" fill="'+G4_COL[p]+'" rx="1"/>';
      });
      const lx = (x+bw/2).toFixed(1), ly = MT+CH+14;
      const lbl = r.fecha.slice(8)+'/'+r.fecha.slice(5,7);
      s += '<text x="'+lx+'" y="'+ly+'" text-anchor="end" font-size="9" fill="#9c8f79" transform="rotate(-40,'+lx+','+ly+')">'+lbl+'</text>';
    });
    s += '<line x1="'+ML+'" y1="'+MT+'" x2="'+ML+'" y2="'+(MT+CH)+'" stroke="#4a3d2e" stroke-width="1"/>';
    s += '<line x1="'+ML+'" y1="'+(MT+CH)+'" x2="'+(ML+CW)+'" y2="'+(MT+CH)+'" stroke="#4a3d2e" stroke-width="1"/>';
    s += '</svg>';
    box.innerHTML = s;

    leyBox.innerHTML = G4_PRODS.map(p =>
      '<span class="graf-ley-item"><span class="graf-dot" style="background:'+G4_COL[p]+'"></span>'+G4_NAME[p]+'</span>'
    ).join('');
  }

  /* ── Gráfica 5: Unidades vendidas en el tiempo ───────────────────────── */
  async function grafica5(){
    const box = document.getElementById('g5-contenedor');
    if(!box) return;
    const data = await _fetchRV();
    if(!data.length){ box.innerHTML = '<p class="graf-vacio">Sin reportes de venta aún.</p>'; return; }

    const W=340, H=170, ML=55, MR=10, MT=15, MB=45;
    const CW=W-ML-MR, CH=H-MT-MB, N=data.length;
    const totales = data.map(r => G4_PRODS.reduce((s,p) => s+(r[p]||0), 0));
    const maxU    = Math.max(...totales, 1);
    const padMax  = maxU * 1.1;
    const toX = i => ML + (N < 2 ? CW/2 : i*(CW/(N-1)));
    const toY = v => MT + CH*(padMax-v)/padMax;
    const baseline = MT + CH;

    const pts = totales.map((v,i) => toX(i).toFixed(1)+','+toY(v).toFixed(1));
    const areaPath = pts.join(' ') + ' ' + toX(N-1).toFixed(1)+','+baseline + ' ' + toX(0).toFixed(1)+','+baseline;

    let s = '<svg viewBox="0 0 '+W+' '+H+'" width="100%" style="display:block">';
    s += _svgYAxis(ML, MT, CH, 0, padMax);
    s += '<polygon points="'+areaPath+'" fill="#e2a03f" opacity="0.25"/>';
    s += '<polyline points="'+pts.join(' ')+'" stroke="#e2a03f" stroke-width="2" fill="none" stroke-linejoin="round"/>';
    totales.forEach((v,i) => {
      s += '<circle cx="'+toX(i).toFixed(1)+'" cy="'+toY(v).toFixed(1)+'" r="2.5" fill="#e2a03f"/>';
    });

    const step = Math.max(1, Math.floor(N/6));
    for(let i=0; i<N; i+=step){
      const lx = toX(i).toFixed(1), ly = MT+CH+14;
      const lbl = data[i].fecha.slice(8)+'/'+data[i].fecha.slice(5,7);
      s += '<text x="'+lx+'" y="'+ly+'" text-anchor="end" font-size="9" fill="#9c8f79" transform="rotate(-40,'+lx+','+ly+')">'+lbl+'</text>';
    }
    s += '<line x1="'+ML+'" y1="'+MT+'" x2="'+ML+'" y2="'+(MT+CH)+'" stroke="#4a3d2e" stroke-width="1"/>';
    s += '<line x1="'+ML+'" y1="'+(MT+CH)+'" x2="'+(ML+CW)+'" y2="'+(MT+CH)+'" stroke="#4a3d2e" stroke-width="1"/>';
    s += '</svg>';
    box.innerHTML = s;
  }

  /* ── Gráfica 6: Efectivo vs Transferencia ────────────────────────────── */
  async function grafica6(){
    const box    = document.getElementById('g6-contenedor');
    const leyBox = document.getElementById('g6-leyenda');
    if(!box) return;
    const data = await _fetchRV();
    if(!data.length){ box.innerHTML = '<p class="graf-vacio">Sin reportes de venta aún.</p>'; return; }

    const W=340, H=175, ML=58, MR=10, MT=15, MB=45;
    const CW=W-ML-MR, CH=H-MT-MB, N=data.length;
    const maxV = Math.max(...data.map(r => (r.efectivo||0)+(r.transferencia||0)), 1);
    const padMax = maxV * 1.1;
    const toX = i => ML + (N < 2 ? CW/2 : i*(CW/(N-1)));
    const toY = v => MT + CH*(padMax-v)/padMax;
    const baseline = (MT+CH).toFixed(1);

    const tfPts    = data.map((r,i) => toX(i).toFixed(1)+','+toY(r.transferencia||0).toFixed(1));
    const totalPts = data.map((r,i) => toX(i).toFixed(1)+','+toY((r.efectivo||0)+(r.transferencia||0)).toFixed(1));
    const tfRev    = [...tfPts].reverse();

    const tfArea    = tfPts.join(' ')    + ' ' + toX(N-1).toFixed(1)+','+baseline + ' ' + toX(0).toFixed(1)+','+baseline;
    const efArea    = totalPts.join(' ') + ' ' + tfRev.join(' ');

    let s = '<svg viewBox="0 0 '+W+' '+H+'" width="100%" style="display:block">';
    s += _svgYAxis(ML, MT, CH, 0, padMax);
    s += '<polygon points="'+tfArea+'" fill="#5498e4" opacity="0.5"/>';
    s += '<polygon points="'+efArea+'" fill="#6fcf97" opacity="0.5"/>';
    s += '<polyline points="'+tfPts.join(' ')+'" stroke="#5498e4" stroke-width="1.5" fill="none" stroke-linejoin="round"/>';
    s += '<polyline points="'+totalPts.join(' ')+'" stroke="#6fcf97" stroke-width="1.5" fill="none" stroke-linejoin="round"/>';

    const step = Math.max(1, Math.floor(N/6));
    for(let i=0; i<N; i+=step){
      const lx = toX(i).toFixed(1), ly = MT+CH+14;
      const lbl = data[i].fecha.slice(8)+'/'+data[i].fecha.slice(5,7);
      s += '<text x="'+lx+'" y="'+ly+'" text-anchor="end" font-size="9" fill="#9c8f79" transform="rotate(-40,'+lx+','+ly+')">'+lbl+'</text>';
    }
    s += '<line x1="'+ML+'" y1="'+MT+'" x2="'+ML+'" y2="'+(MT+CH)+'" stroke="#4a3d2e" stroke-width="1"/>';
    s += '<line x1="'+ML+'" y1="'+(MT+CH)+'" x2="'+(ML+CW)+'" y2="'+(MT+CH)+'" stroke="#4a3d2e" stroke-width="1"/>';
    s += '</svg>';
    box.innerHTML = s;

    leyBox.innerHTML =
      '<span class="graf-ley-item"><span class="graf-dot" style="background:#6fcf97"></span>Efectivo</span>' +
      '<span class="graf-ley-item"><span class="graf-dot" style="background:#5498e4"></span>Transferencia</span>';
  }

