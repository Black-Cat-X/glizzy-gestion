  /* ============================================================
     FASE 3: INVENTARIO
     ============================================================ */
  let stockData = [];

  async function cargarStock(){
    const lista   = document.getElementById('stock-lista');
    const panel   = document.getElementById('lista-sugerida-panel');
    lista.innerHTML = '<span style="color:#9c8f79;font-size:13px">Cargando…</span>';
    try {
      const { data, error } = await db
        .from('stock_actual')
        .select('id,nombre,unidad,minimo_semana_baja,stock');
      if(error) throw error;
      stockData = data || [];

      // Render stock
      lista.innerHTML = stockData.length
        ? stockData.map(s => {
            const v  = parseFloat(s.stock);
            const mn = s.minimo_semana_baja;
            const cls = mn > 0 && v < mn        ? 'stock-bajo'
                      : mn > 0 && v < mn * 1.5  ? 'stock-medio'
                      : 'stock-ok';
            return `<div class="stock-row">
              <span class="stock-ind ${cls}">●</span>
              <span class="stock-nombre">${esc(s.nombre)}</span>
              <span class="stock-cant">${v % 1 === 0 ? v : v.toFixed(2)}</span>
              <span class="stock-unidad">${esc(s.unidad)}</span>
            </div>`;
          }).join('')
        : '<span style="color:#9c8f79;font-size:13px">Sin datos.</span>';

      // Render sugerida
      const bajos = stockData.filter(s => s.minimo_semana_baja > 0 && parseFloat(s.stock) < s.minimo_semana_baja);
      if(bajos.length){
        document.getElementById('lista-sugerida').innerHTML = bajos.map(s =>
          `<div class="stock-row">
            <span class="stock-ind stock-bajo">●</span>
            <span class="stock-nombre">${esc(s.nombre)}</span>
            <span class="stock-cant">${parseFloat(s.stock)} / ${s.minimo_semana_baja}</span>
            <span class="stock-unidad">${esc(s.unidad)}</span>
          </div>`
        ).join('');
        panel.hidden = false;
      } else {
        panel.hidden = true;
      }

      // Poblar selects
      const opts = '<option value="">— Selecciona —</option>' +
        stockData.map(s => `<option value="${s.id}">${esc(s.nombre)}</option>`).join('');
      document.getElementById('compra-insumo').innerHTML = opts;
      document.getElementById('ajuste-insumo').innerHTML = opts;
    } catch(e){
      lista.innerHTML = `<span style="color:#f1b7ab;font-size:12px">Error: ${esc(e.message || '')}</span>`;
    }
  }

  async function registrarCompra(){
    const insumoId = parseInt(document.getElementById('compra-insumo').value);
    const cantidad = parseFloat(document.getElementById('compra-cantidad').value);
    const valor    = parseFloat(document.getElementById('compra-valor').value);
    if(!insumoId || !(cantidad > 0) || !(valor > 0)){
      mostrarError('error-inv', 'Completa: insumo, cantidad y valor total.');
      return;
    }
    const btn = document.getElementById('btn-compra');
    btn.disabled = true; btn.textContent = 'Guardando…';
    ocultarError('error-inv');
    const fecha = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    const { error } = await db.rpc('registrar_compra', {
      p_insumo_id: insumoId, p_cantidad: cantidad,
      p_valor_total: valor,  p_fecha: fecha
    });
    btn.disabled = false; btn.textContent = 'Registrar compra';
    if(error){ mostrarError('error-inv', 'Error: ' + error.message); return; }
    document.getElementById('compra-cantidad').value = '';
    document.getElementById('compra-valor').value    = '';
    document.getElementById('compra-insumo').value   = '';
    cargarStock();
    cargarCompras();
  }

  async function registrarAjuste(){
    const insumoId = parseInt(document.getElementById('ajuste-insumo').value);
    const tipo     = document.getElementById('ajuste-tipo').value;
    const cantRaw  = parseFloat(document.getElementById('ajuste-cantidad').value);
    if(!insumoId || !(cantRaw > 0)){
      mostrarError('error-inv', 'Selecciona un insumo e ingresa una cantidad válida.');
      return;
    }
    const cantidad = tipo === 'agregar' ? cantRaw : -cantRaw;
    const btn = document.getElementById('btn-ajuste');
    btn.disabled = true; btn.textContent = 'Guardando…';
    ocultarError('error-inv');
    const fecha = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    const { error } = await db.from('movimientos_stock').insert({
      fecha, insumo_id: insumoId, tipo, cantidad
    });
    btn.disabled = false; btn.textContent = 'Registrar ajuste';
    if(error){ mostrarError('error-inv', 'Error: ' + error.message); return; }
    document.getElementById('ajuste-cantidad').value = '';
    document.getElementById('ajuste-insumo').value   = '';
    cargarStock();
  }

  document.getElementById('btn-refrescar').addEventListener('click', cargarStock);
  document.getElementById('btn-compra').addEventListener('click', registrarCompra);
  document.getElementById('btn-ajuste').addEventListener('click', registrarAjuste);

