  /* ============================================================
     AUTENTICACIÓN
     ============================================================ */
  // Arranque: verificar sesión guardada
  db.auth.getSession()
    .then(({ data: { session } }) => {
      if(session){ mostrarApp(session.user); }
      // sin sesión: pantalla-login ya es visible, no hace falta llamar mostrarLogin()
    })
    .catch(() => { /* sin sesión: pantalla-login ya visible */ });

  // Cambios posteriores: solo reaccionar a login/logout explícitos
  db.auth.onAuthStateChange((evento, sesion) => {
    if(evento === 'SIGNED_IN' && sesion){ mostrarApp(sesion.user); }
    else if(evento === 'SIGNED_OUT'){     mostrarLogin(); }
  });

  function mostrarLogin(){
    document.getElementById('pantalla-login').hidden = false;
    document.getElementById('app').hidden = true;
    const btn = document.getElementById('btn-login');
    btn.textContent = 'Entrar';
    btn.disabled = false;
  }

  function mostrarApp(usuario){
    document.getElementById('pantalla-login').hidden = true;
    document.getElementById('app').hidden = false;
    activarTab('venta');
    recibirCompartido();
    cargarHistorial();
  }

  document.getElementById('form-login').addEventListener('submit', async function(e){
    e.preventDefault();
    if(!navigator.onLine){
      mostrarError('error-login', 'Sin conexión. Conéctate a internet para iniciar sesión.');
      return;
    }
    const email = document.getElementById('inp-email').value.trim();
    const pass  = document.getElementById('inp-pass').value;
    const btn   = document.getElementById('btn-login');
    ocultarError('error-login');
    btn.textContent = 'Entrando…';
    btn.disabled = true;
    const { error } = await db.auth.signInWithPassword({ email, password: pass });
    if(error){
      mostrarError('error-login', 'No se pudo iniciar sesión: ' + (error.message || 'error desconocido'));
      btn.textContent = 'Entrar';
      btn.disabled = false;
    }
  });

  document.getElementById('btn-salir').addEventListener('click', async () => {
    await db.auth.signOut();
  });

  /* ============================================================
     NAVEGACIÓN DE TABS
     ============================================================ */
  function activarTab(nombre){
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('activo', btn.dataset.tab === nombre);
    });
    document.querySelectorAll('.tab-contenido').forEach(sec => {
      sec.hidden = (sec.id !== 'tab-' + nombre);
    });
  }
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activarTab(btn.dataset.tab);
      if(btn.dataset.tab === 'venta')     cargarHistorial();
      if(btn.dataset.tab === 'inventario') { cargarStock(); cargarCompras(); }
      if(btn.dataset.tab === 'finanzas')   { cargarFinanzas(); cargarImprevistos(); }
      if(btn.dataset.tab === 'exportar')   cargarGraficas();
    });
  });


  /* ============================================================
     SERVICE WORKER
     ============================================================ */
  if('serviceWorker' in navigator && location.protocol.startsWith('http')){
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
