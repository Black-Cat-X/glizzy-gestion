  /* ============================================================
     FASE 2: GUARDAR VENTA E HISTORIAL
     ============================================================ */
  async function verificarGuardado(fecha){
    const btn = document.getElementById('btn-guardar');
    try {
      const { data } = await db.from('reportes_venta')
        .select('fecha').eq('fecha', fecha).maybeSingle();
      if(data){
        btn.disabled = true;
        btn.className = 'toggle btn-guardar guardado';
        btn.textContent = '✓ Ya guardado';
      } else {
        btn.disabled = false;
        btn.textContent = 'Guardar en Supabase';
      }
    } catch(_){ btn.disabled = false; btn.textContent = 'Guardar en Supabase'; }
  }

  async function guardarVenta(){
    if(!ultimoData || !ultimoResumen) return;
    const btn = document.getElementById('btn-guardar');
    btn.disabled = true;
    btn.textContent = 'Guardando…';
    try {
      const { error } = await db.rpc('guardar_venta', {
        p_fecha:            ultimoData.fecha,
        p_vendedor:         ultimoData.vendedor,
        p_firma:            ultimoData.firma,
        p_num_ventas:       ultimoResumen.numVentas,
        p_perros:           ultimoResumen.perros,
        p_combos:           ultimoResumen.combos,
        p_gaseosas_sueltas: ultimoResumen.gaseosasSueltas,
        p_adic_ca:          ultimoResumen.adicionales.CA,
        p_adic_ce:          ultimoResumen.adicionales.CE,
        p_adic_po:          ultimoResumen.adicionales.PO,
        p_tostilocos:       ultimoResumen.snacksPor.TO,
        p_dorilokos:        ultimoResumen.snacksPor.DO,
        p_efectivo:         ultimoResumen.efectivo,
        p_transferencia:    ultimoResumen.transferencia,
        p_total:            ultimoResumen.total,
        p_cuadra:           ultimoResumen.cuadra,
        p_payload:          document.getElementById('input').value.trim(),
        p_ventas:           ultimoData.ventas
      });
      if(error) throw error;
      btn.className = 'toggle btn-guardar guardado';
      btn.textContent = '✓ Guardado';
      setEstado('Venta guardada correctamente.', 'ok');
      cargarHistorial();
    } catch(e){
      const msg = e.message || '';
      if(msg.includes('Ya existe') || msg.includes('unique_violation')){
        btn.className = 'toggle btn-guardar guardado';
        btn.textContent = '✓ Ya guardado';
        setEstado('Esta fecha ya estaba guardada.', 'ok');
        cargarHistorial();
      } else {
        btn.disabled = false;
        btn.textContent = 'Guardar en Supabase';
        mostrarError('error', 'No se pudo guardar: ' + (msg || 'error desconocido'));
      }
    }
  }

  document.getElementById('btn-guardar').addEventListener('click', guardarVenta);

  async function cargarHistorial(){
    if(!document.getElementById('historial-panel')) return;
    try {
      const { data, error } = await db
        .from('reportes_venta')
        .select('fecha,vendedor,perros,combos,gaseosas_sueltas,adic_ca,adic_ce,adic_po,tostilocos,dorilokos,efectivo,transferencia,total,cuadra')
        .order('fecha', { ascending: false })
        .limit(20);
      if(error || !data || !data.length){
        document.getElementById('historial-panel').hidden = true;
        return;
      }
      document.getElementById('historial-lista').innerHTML = data.map(r => {
        const f   = r.fecha.slice(5).replace('-', '/');
        const dId = 'hd-' + r.fecha;
        const extras = [
          r.adic_ca    ? `CA: <span class="v">${r.adic_ca}</span>`   : '',
          r.adic_ce    ? `CE: <span class="v">${r.adic_ce}</span>`   : '',
          r.adic_po    ? `PO: <span class="v">${r.adic_po}</span>`   : '',
          r.tostilocos ? `TO: <span class="v">${r.tostilocos}</span>`: '',
          r.dorilokos  ? `DO: <span class="v">${r.dorilokos}</span>` : ''
        ].filter(Boolean).map(x => `<span>${x}</span>`).join('');
        return `<div class="hist-item">
          <div class="hist-row">
            <span class="hist-fecha">${f}</span>
            <span class="hist-vendor">${esc(r.vendedor)}</span>
            <span class="hist-total">${fmt(r.total)}</span>
            <span class="${r.cuadra ? 'hist-ok' : 'hist-warn'}">${r.cuadra ? '✓' : '⚠'}</span>
            <button class="hist-btn-ver" data-target="${dId}">Ver</button>
          </div>
          <div class="hist-detalle" id="${dId}">
            <div class="hist-d-row">
              <span>Efectivo: <span class="v">${fmt(r.efectivo)}</span></span>
              <span>Transf.: <span class="v">${fmt(r.transferencia)}</span></span>
            </div>
            <div class="hist-d-row">
              <span>${r.perros} perros</span>
              <span>${r.combos} combos</span>
              <span>${r.gaseosas_sueltas} gaseosas</span>
            </div>
            ${extras ? `<div class="hist-d-row">${extras}</div>` : ''}
            <button class="hist-btn-del" data-fecha="${esc(r.fecha)}">
              Eliminar este reporte
            </button>
          </div>
        </div>`;
      }).join('');

      // Toggle detalle
      document.getElementById('historial-lista').querySelectorAll('.hist-btn-ver')
        .forEach(btn => btn.addEventListener('click', () => {
          const d = document.getElementById(btn.dataset.target);
          const ok = d.classList.toggle('abierto');
          btn.textContent = ok ? 'Cerrar' : 'Ver';
        }));

      // Eliminar reporte
      document.getElementById('historial-lista').querySelectorAll('.hist-btn-del')
        .forEach(btn => btn.addEventListener('click', async () => {
          const fecha = btn.dataset.fecha;
          if(!confirm(
            '¿Eliminar el reporte del ' + fecha + '?\n\n' +
            'Se borrarán el detalle de ventas y los movimientos de stock de ese día. ' +
            'Podrás volver a guardar el reporte correcto desde el QR.\n\n' +
            'Esta acción no se puede deshacer.'
          )) return;
          btn.disabled = true; btn.textContent = 'Eliminando…';
          const { error } = await db.from('reportes_venta').delete().eq('fecha', fecha);
          if(error){
            btn.disabled = false; btn.textContent = 'Eliminar este reporte';
            alert('Error: ' + error.message);
            return;
          }
          // Si el recibo actual era ese día, limpiarlo
          if(ultimoData && ultimoData.fecha === fecha){
            ultimoData = null; ultimoResumen = null;
            document.getElementById('receiptWrap').style.display = 'none';
            const btnG = document.getElementById('btn-guardar');
            btnG.disabled = true;
            btnG.className = 'toggle btn-guardar';
            btnG.textContent = 'Guardar en Supabase';
          }
          cargarHistorial();
        }));

      document.getElementById('historial-panel').hidden = false;
    } catch(_){ document.getElementById('historial-panel').hidden = true; }
  }

  async function cargarCompras(){
    const panel = document.getElementById('compras-panel');
    const lista = document.getElementById('compras-lista');
    if(!panel || !lista) return;
    try {
      const { data, error } = await db
        .from('gastos')
        .select('id, fecha, concepto, valor, movimiento_id')
        .eq('categoria', 'inventario')
        .order('fecha', { ascending: false })
        .limit(30);
      if(error || !data || data.length === 0){ panel.hidden = true; return; }
      lista.innerHTML = data.map(g => {
        const d = new Date(g.fecha + 'T12:00:00');
        const f = d.toLocaleDateString('es-CO', { day:'2-digit', month:'2-digit' });
        const v = '$' + g.valor.toLocaleString('es-CO');
        const concepto = g.concepto.replace('Compra: ', '');
        return '<div class="gasto-row">' +
          '<span class="gasto-fecha">' + f + '</span>' +
          '<span class="gasto-concepto">' + concepto + '</span>' +
          '<span class="gasto-valor">' + v + '</span>' +
          '<button class="gasto-del" data-mid="' + g.movimiento_id + '">Borrar</button>' +
          '</div>';
      }).join('');
      panel.hidden = false;
      lista.querySelectorAll('.gasto-del').forEach(btn => {
        btn.addEventListener('click', async () => {
          const mid = btn.dataset.mid;
          if(!confirm('¿Eliminar esta compra?\n\nSe revertirá el movimiento de stock.')) return;
          btn.disabled = true;
          const { error } = await db.from('movimientos_stock').delete().eq('id', mid);
          if(error){ alert('Error al eliminar: ' + error.message); btn.disabled = false; return; }
          cargarStock();
          cargarCompras();
        });
      });
    } catch(_){ panel.hidden = true; }
  }

  async function cargarImprevistos(){
    const panel = document.getElementById('imprevistos-panel');
    const lista = document.getElementById('imprevistos-lista');
    if(!panel || !lista) return;
    try {
      const { data, error } = await db
        .from('gastos')
        .select('id, fecha, concepto, valor')
        .eq('categoria', 'imprevisto')
        .order('fecha', { ascending: false })
        .limit(30);
      if(error || !data || data.length === 0){ panel.hidden = true; return; }
      lista.innerHTML = data.map(g => {
        const d = new Date(g.fecha + 'T12:00:00');
        const f = d.toLocaleDateString('es-CO', { day:'2-digit', month:'2-digit' });
        const v = '$' + g.valor.toLocaleString('es-CO');
        return '<div class="gasto-row">' +
          '<span class="gasto-fecha">' + f + '</span>' +
          '<span class="gasto-concepto">' + g.concepto + '</span>' +
          '<span class="gasto-valor">' + v + '</span>' +
          '<button class="gasto-del" data-id="' + g.id + '">Borrar</button>' +
          '</div>';
      }).join('');
      panel.hidden = false;
      lista.querySelectorAll('.gasto-del').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          if(!confirm('¿Eliminar este imprevisto?\n\nNo se puede deshacer.')) return;
          btn.disabled = true;
          const { error } = await db.from('gastos').delete().eq('id', id);
          if(error){ alert('Error al eliminar: ' + error.message); btn.disabled = false; return; }
          calcularResumen();
          cargarImprevistos();
        });
      });
    } catch(_){ panel.hidden = true; }
  }

  /* ============================================================
     PARSER G1
     Migrado de Black-Cat-X/Glizzy-app (parsePayload + analizar)
     ============================================================ */
  const NOMBRES_ADIC  = { CA: 'Carne y maíz', CE: 'Cerdo y piña', PO: 'Pollo y tocineta' };
  const NOMBRES_SNACK = { TO: 'Tostilocos', DO: 'Dorilokos' };

  function splitN(str, sep, n){
    const out = [];
    let rest = str;
    for(let i = 0; i < n; i++){
      const k = rest.indexOf(sep);
      if(k < 0) break;
      out.push(rest.slice(0, k));
      rest = rest.slice(k + sep.length);
    }
    out.push(rest);
    return out;
  }

  function parseCatalogo(raw, prefijo){
    const map = {};
    if(!raw || !raw.startsWith(prefijo + ':')) return map;
    const cuerpo = raw.slice(prefijo.length + 1);
    if(!cuerpo) return map;
    cuerpo.split('-').forEach(pair => {
      const [id, abbr] = pair.split('+');
      if(id && abbr) map[id] = abbr;
    });
    return map;
  }

  function parsePayload(raw){
    const parts = raw.replace(/\s+/g, '').split('*');
    if(parts[0] !== 'G1'){
      throw new Error('El código no tiene el formato esperado (debe iniciar con G1 y usar "*" como separador).');
    }
    if(parts.length < 6) throw new Error('El código está incompleto: faltan campos obligatorios.');

    const [version, fechaRaw, vendedor, firma, resumenRaw] = parts;

    if(!/^\d{6}$/.test(fechaRaw)) throw new Error('Campo de fecha inválido: "' + fechaRaw + '"');
    const fecha = `20${fechaRaw.slice(0,2)}-${fechaRaw.slice(2,4)}-${fechaRaw.slice(4,6)}`;

    if(!/^[A-Z0-9]{1,12}$/.test(vendedor)) throw new Error('Campo de vendedor inválido: "' + vendedor + '"');
    if(!/^[0-9A-F]{10}$/.test(firma))      throw new Error('Campo de firma inválido: "' + firma + '"');

    const rParts = resumenRaw.split(':');
    if(rParts[0] !== 'R' || rParts.length !== 5 || !rParts.slice(1).every(x => /^\d+$/.test(x))){
      throw new Error('Campo de resumen (R) inválido.');
    }
    const resumen = { cant: +rParts[1], total: +rParts[2], efectivo: +rParts[3], transferencia: +rParts[4] };

    let idx = 5;
    const catAdic  = parseCatalogo(parts[idx], 'C');
    if(parts[idx] && parts[idx].startsWith('C:')) idx++;
    const catSnack = parseCatalogo(parts[idx], 'N');
    if(parts[idx] && parts[idx].startsWith('N:')) idx++;

    const ventasRaw = parts.slice(idx).filter(v => v !== '');

    const ventas = ventasRaw.map((v, i) => {
      const [hhmm, totalStr, metodoStr, lineasStr] = splitN(v, ':', 3);
      if(!/^\d{4}$/.test(hhmm) || !/^\d+$/.test(totalStr || '') || !/^[01]$/.test(metodoStr || '') || !lineasStr){
        throw new Error(`Registro de venta #${i+1} mal formado: "${v}"`);
      }
      const items = lineasStr.split('/').map(linea => {
        const f = linea.split(':');
        if(f[0] === 'P'){
          if(f.length !== 4 || !/^\d+$/.test(f[1]) || !/^[01]$/.test(f[2]))
            throw new Error(`Línea de perro mal formada: "${linea}"`);
          const adicIds = f[3] ? f[3].split('.').filter(Boolean) : [];
          const abbrs   = adicIds.map(id => catAdic[id] || null);
          return {
            tipo: 'P', cant: +f[1], combo: f[2] === '1',
            adicAbbrs:  abbrs.filter(Boolean),
            adicionales: adicIds.map((id, k) => NOMBRES_ADIC[abbrs[k]] || abbrs[k] || `Adicional #${id}`)
          };
        }
        if(f[0] === 'G'){
          if(f.length !== 2 || !/^\d+$/.test(f[1]))
            throw new Error(`Línea de gaseosa mal formada: "${linea}"`);
          return { tipo: 'G', cant: +f[1] };
        }
        if(f[0] === 'S'){
          if(f.length !== 4 || !/^\d+$/.test(f[1]) || !/^[01]$/.test(f[2]))
            throw new Error(`Línea de snack mal formada: "${linea}"`);
          const abbr   = f[3] ? (catSnack[f[3]] || null) : null;
          const nombre = f[3] ? (NOMBRES_SNACK[abbr] || abbr || `Snack #${f[3]}`) : 'Snack';
          return { tipo: 'S', cant: +f[1], combo: f[2] === '1', abbr, nombre };
        }
        throw new Error(`Tipo de línea desconocido: "${linea}"`);
      });
      return { hhmm, total: +totalStr, metodo: +metodoStr, items };
    });

    return { version, fecha, vendedor, firma, resumen, ventas };
  }

  function analizar(data){
    let perros = 0, combos = 0, gaseosasSueltas = 0, snacks = 0;
    let efectivo = 0, transferencia = 0;
    const adicionales = { CA: 0, CE: 0, PO: 0 };
    const snacksPor   = { TO: 0, DO: 0 };

    data.ventas.forEach(v => {
      if(v.metodo === 0) efectivo += v.total; else transferencia += v.total;
      v.items.forEach(it => {
        if(it.tipo === 'P'){
          perros += it.cant;
          if(it.combo) combos += it.cant;
          it.adicAbbrs.forEach(a => { if(a in adicionales) adicionales[a] += it.cant; });
        } else if(it.tipo === 'S'){
          snacks += it.cant;
          if(it.combo) combos += it.cant;
          if(it.abbr in snacksPor) snacksPor[it.abbr] += it.cant;
        } else {
          gaseosasSueltas += it.cant;
        }
      });
    });

    const total = efectivo + transferencia;
    const horas = data.ventas.map(v => v.hhmm).sort();
    const R     = data.resumen;
    const problemas = [];

    if(R.efectivo + R.transferencia !== R.total)
      problemas.push('en el R, efectivo + transferencia no da el total del día');
    if(data.ventas.length !== R.cant)
      problemas.push(`el R dice ${R.cant} ventas y vienen ${data.ventas.length}`);
    if(total !== R.total)
      problemas.push(`la suma de las ventas (${fmt(total)}) no coincide con el total del R (${fmt(R.total)})`);
    if(efectivo      !== R.efectivo)      problemas.push('el efectivo no coincide con el R');
    if(transferencia !== R.transferencia) problemas.push('la transferencia no coincide con el R');

    return {
      perros, combos, gaseosasSueltas, snacks, snacksPor,
      efectivo, transferencia, total, adicionales,
      numVentas:  data.ventas.length,
      horaInicio: horas[0],
      horaFin:    horas[horas.length - 1],
      problemas,  cuadra: problemas.length === 0
    };
  }

  /* ============================================================
     RENDER DEL RECIBO
     ============================================================ */
  function render(data, r){
    document.getElementById('rSub').textContent     = `${data.vendedor} · ${data.fecha}`;
    document.getElementById('rVentas').textContent  = `${r.numVentas} ${r.numVentas === 1 ? 'venta' : 'ventas'}`;
    document.getElementById('rRango').textContent   = r.numVentas ? `${fmtHora(r.horaInicio)} – ${fmtHora(r.horaFin)}` : 'Sin ventas';
    document.getElementById('rPerros').textContent  = r.perros;
    document.getElementById('rCombos').textContent  = `${r.combos} combos`;
    document.getElementById('rGaseosas').textContent = `${r.gaseosasSueltas} gaseosas sueltas`;
    document.getElementById('rSnacks').textContent  =
      `${r.snacks} snacks` + (r.snacks ? ` (Tostilocos ${r.snacksPor.TO} · Dorilokos ${r.snacksPor.DO})` : '');
    document.getElementById('rEfectivo').textContent     = fmt(r.efectivo);
    document.getElementById('rTransferencia').textContent = fmt(r.transferencia);
    document.getElementById('rTotal').textContent   = fmt(r.total);
    document.getElementById('rFirma').textContent   = `Firma: ${data.firma}`;

    const check = document.getElementById('rCheck');
    if(r.cuadra){
      check.textContent = '✓ Las ventas cuadran con el resumen (R). La firma solo se puede verificar en el servidor.';
      check.className = 'r-check ok';
    } else {
      check.textContent = '⚠ No cuadra: ' + r.problemas.join('; ') + '. Posible edición del código.';
      check.className = 'r-check bad';
    }

    const body = document.getElementById('detalleBody');
    body.innerHTML = data.ventas.length ? data.ventas.map((v, i) => {
      const itemsTxt = v.items.map(it => {
        if(it.tipo === 'P'){
          let t = `${it.cant}× perro${it.combo ? ' combo' : ''}`;
          if(it.adicionales.length) t += ' + ' + it.adicionales.join(', ');
          return t;
        }
        if(it.tipo === 'S') return `${it.cant}× ${it.nombre}${it.combo ? ' combo' : ''}`;
        return `${it.cant}× gaseosa suelta`;
      }).join(' / ');
      const cls = v.metodo === 0 ? 'metodo-ef' : 'metodo-tf';
      return `<tr>
        <td>${i + 1}</td>
        <td class="num">${fmtHora(v.hhmm)}</td>
        <td class="num">${fmt(v.total)}</td>
        <td class="${cls}">${v.metodo === 0 ? 'Efectivo' : 'Transf.'}</td>
        <td>${esc(itemsTxt)}</td>
      </tr>`;
    }).join('') : '<tr><td colspan="5">No hubo ventas este día.</td></tr>';

    document.getElementById('receiptWrap').style.display = 'block';
    ocultarError('error');
  }

  /* ============================================================
     LÓGICA DE VENTA (tab)
     ============================================================ */
  let ultimoData = null, ultimoResumen = null;

  function procesar(){
    const raw = document.getElementById('input').value;
    try{
      const data    = parsePayload(raw);
      const resumen = analizar(data);
      ultimoData = data; ultimoResumen = resumen;
      render(data, resumen);
      const btnG = document.getElementById('btn-guardar');
      btnG.disabled = true;
      btnG.className = 'toggle btn-guardar';
      btnG.textContent = 'Comprobando…';
      verificarGuardado(data.fecha);
      return true;
    } catch(e){
      mostrarError('error', e.message);
      document.getElementById('receiptWrap').style.display = 'none';
      return false;
    }
  }

  document.getElementById('analizar').addEventListener('click', procesar);

  document.getElementById('limpiar').addEventListener('click', () => {
    document.getElementById('input').value = '';
    setEstado('', '');
    ocultarError('error');
    document.getElementById('receiptWrap').style.display = 'none';
    ultimoData = null; ultimoResumen = null;
    const btnL = document.getElementById('btn-guardar');
    btnL.disabled = true;
    btnL.className = 'toggle btn-guardar';
    btnL.textContent = 'Guardar en Supabase';
  });

  document.getElementById('toggleDetalle').addEventListener('click', function(){
    const d       = document.getElementById('detalle');
    const showing = d.style.display === 'block';
    d.style.display = showing ? 'none' : 'block';
    this.textContent = showing ? 'Ver detalle de ventas ▾' : 'Ocultar detalle ▴';
  });

  /* ============================================================
     FOTO DEL QR
     ============================================================ */
  const estado = document.getElementById('estado');
  const setEstado = (txt, cls) => {
    estado.textContent = txt;
    estado.className   = 'estado ' + (cls || '');
  };

  async function imagenAData(file){
    let src;
    try{ src = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch(e){
      src = await new Promise((res, rej) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = () => rej(new Error('No pude abrir esa imagen.'));
        im.src = URL.createObjectURL(file);
      });
    }
    const W = src.width  || src.naturalWidth;
    const H = src.height || src.naturalHeight;
    const k = Math.min(1, 1600 / Math.max(W, H));
    const cv  = document.createElement('canvas');
    cv.width  = Math.round(W * k);
    cv.height = Math.round(H * k);
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, cv.width, cv.height);
    return ctx.getImageData(0, 0, cv.width, cv.height);
  }

  async function leerFoto(file){
    if(!file || !file.type.startsWith('image/')){
      setEstado('Ese archivo no es una imagen.', 'bad');
      return;
    }
    setEstado('Leyendo el QR…', '');
    await new Promise(r => setTimeout(r, 30));
    try{
      const img = await imagenAData(file);
      const res = GlizzyQR.leer(img.data, img.width, img.height, jsQR);
      if(!res){
        setEstado('No pude leer el QR de esa foto. Pídele otra: QR grande, enfocado (tocar la pantalla), sin inclinar. O pega el código a mano abajo.', 'bad');
        return;
      }
      document.getElementById('input').value = res.texto;
      if(!procesar()){ setEstado('Leí el QR pero el código no tiene el formato esperado (ver error abajo).', 'bad'); return; }
      if(!ultimoResumen.cuadra){ setEstado('QR leído, pero las cuentas no cuadran. Revisa el aviso antes de guardar.', 'warn'); return; }
      setEstado('✓ QR leído. Revisa el recibo y pulsa Guardar.', 'ok');
    } catch(e){
      setEstado(e.message || 'Error leyendo la imagen.', 'bad');
    }
  }

  const drop    = document.getElementById('drop');
  const archivo = document.getElementById('archivo');

  drop.addEventListener('click',   () => archivo.click());
  drop.addEventListener('keydown', e => {
    if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); archivo.click(); }
  });
  archivo.addEventListener('change', () => {
    if(archivo.files[0]) leerFoto(archivo.files[0]);
    archivo.value = '';
  });
  ['dragenter','dragover'].forEach(ev =>
    drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); })
  );
  ['dragleave','drop'].forEach(ev =>
    drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); })
  );
  drop.addEventListener('drop', e => {
    const f = e.dataTransfer.files[0];
    if(f) leerFoto(f);
  });
  document.addEventListener('paste', e => {
    const it = [...(e.clipboardData ? e.clipboardData.items : [])]
      .find(i => i.type.startsWith('image/'));
    if(it){ e.preventDefault(); leerFoto(it.getAsFile()); }
  });

  /* ============================================================
     SHARE TARGET (Android: foto compartida desde WhatsApp)
     ============================================================ */
  async function recibirCompartido(){
    if(!/[?&]compartido=1/.test(location.search)) return;
    history.replaceState(null, '', location.pathname);
    setEstado('Recibiendo la foto compartida…', '');
    try{
      const c = await caches.open('glizzy-share');
      const r = await c.match('foto-compartida');
      if(!r){ setEstado('No llegó ninguna foto. Intenta compartirla de nuevo.', 'bad'); return; }
      const blob = await r.blob();
      await c.delete('foto-compartida');
      await leerFoto(new File([blob], 'foto.jpg', { type: blob.type || 'image/jpeg' }));
    } catch(e){
      setEstado('No pude recibir la foto compartida. Elígela con el botón de arriba.', 'bad');
    }
  }

