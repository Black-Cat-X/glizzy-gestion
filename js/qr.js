// ---------- Lector de QR a partir de fotos de pantalla (con anti-moiré) ----------
// Fotografiar un monitor genera un patrón de líneas (moiré) que confunde a jsQR.
// Solución: reducir/desenfocar la foto antes de leerla y reintentar con varios ajustes.
const GlizzyQR = (function(){
  function aGris(rgba, n){
    const g = new Float32Array(n);
    for(let i = 0, j = 0; i < n; i++, j += 4){
      g[i] = 0.299 * rgba[j] + 0.587 * rgba[j+1] + 0.114 * rgba[j+2];
    }
    return g;
  }
  function reducir(g, w, h, s){            // promedio por áreas
    if(s >= 0.999) return { g, w, h };
    const tw = Math.max(1, Math.round(w * s)), th = Math.max(1, Math.round(h * s));
    const out = new Float32Array(tw * th);
    for(let y = 0; y < th; y++){
      const y0 = Math.floor(y * h / th), y1 = Math.max(y0 + 1, Math.floor((y + 1) * h / th));
      for(let x = 0; x < tw; x++){
        const x0 = Math.floor(x * w / tw), x1 = Math.max(x0 + 1, Math.floor((x + 1) * w / tw));
        let suma = 0;
        for(let yy = y0; yy < y1; yy++){
          const base = yy * w;
          for(let xx = x0; xx < x1; xx++) suma += g[base + xx];
        }
        out[y * tw + x] = suma / ((y1 - y0) * (x1 - x0));
      }
    }
    return { g: out, w: tw, h: th };
  }
  function desenfocar(g, w, h, r){          // desenfoque de caja separable, radio r
    if(r <= 0) return g;
    const tmp = new Float32Array(g.length), out = new Float32Array(g.length);
    const win = 2 * r + 1;
    for(let y = 0; y < h; y++){
      const b = y * w;
      for(let x = 0; x < w; x++){
        let s = 0;
        for(let k = -r; k <= r; k++){ const xx = Math.min(w - 1, Math.max(0, x + k)); s += g[b + xx]; }
        tmp[b + x] = s / win;
      }
    }
    for(let x = 0; x < w; x++){
      for(let y = 0; y < h; y++){
        let s = 0;
        for(let k = -r; k <= r; k++){ const yy = Math.min(h - 1, Math.max(0, y + k)); s += tmp[yy * w + x]; }
        out[y * w + x] = s / win;
      }
    }
    return out;
  }
  function aRGBA(g, n){
    const o = new Uint8ClampedArray(n * 4);
    for(let i = 0, j = 0; i < n; i++, j += 4){ o[j] = o[j+1] = o[j+2] = g[i]; o[j+3] = 255; }
    return o;
  }

  // Intentos en orden: primero lo que más funciona con fotos de pantalla (reducir a la mitad)
  const INTENTOS = [
    { s: 0.5,  b: 0 }, { s: 0.5,  b: 1 }, { s: 0.75, b: 1 }, { s: 0.75, b: 2 },
    { s: 0.6,  b: 1 }, { s: 0.4,  b: 0 }, { s: 1,    b: 0 }, { s: 1,    b: 2 },
    { s: 1,    b: 4 }, { s: 0.3,  b: 0 }, { s: 0.85, b: 2 }
  ];

  // rgba: Uint8ClampedArray de la foto; jsQR: la función de la librería
  function leer(rgba, w, h, jsQR){
    const gris = aGris(rgba, w * h);
    for(let i = 0; i < INTENTOS.length; i++){
      const { s, b } = INTENTOS[i];
      const red = reducir(gris, w, h, s);
      const g2 = desenfocar(red.g, red.w, red.h, b);
      const r = jsQR(aRGBA(g2, red.w * red.h), red.w, red.h, { inversionAttempts: 'dontInvert' });
      if(r && r.data) return { texto: r.data, intento: i + 1 };
    }
    return null;
  }
  return { leer };
})();
if(typeof module !== 'undefined') module.exports = GlizzyQR;
