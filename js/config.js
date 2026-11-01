    /* ============================================================
     SUPABASE CONFIG
     ============================================================ */
  const SUPABASE_URL = 'https://wvxcgtyogsirqnpazfiy.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2eGNndHlvZ3NpcnFucGF6Zml5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0MDk4ODksImV4cCI6MjEwODk4NTg4OX0.3EuiWscXWpR466rxI7fK8EFaibdPiwZgtqw96M0XT08';
  const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  /* ============================================================
     OFFLINE DETECTION
     ============================================================ */
  function actualizarConexion(){
    document.getElementById('toast-offline').hidden = navigator.onLine;
  }
  window.addEventListener('online',  actualizarConexion);
  window.addEventListener('offline', actualizarConexion);
  actualizarConexion();

