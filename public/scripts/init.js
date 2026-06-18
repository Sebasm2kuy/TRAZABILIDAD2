// Trazabilidad init scripts - combined from layout.tsx inline scripts

// Script 1: Reset logic - clear localStorage if ?reset=1 is in the URL
(function () {
  try {
    var p = new URLSearchParams(window.location.search);
    if (p.get('reset') === '1') {
      var keys = [
        'trazabilidad_new_records', 'trazabilidad_exp_edits', 'trazabilidad_exp_deleted',
        'trazabilidad_exp_ingresos', 'trazabilidad_dep_edits', 'trazabilidad_dep_new_records',
        'trazabilidad_dep_deleted', 'cruce_caliral_edits', 'trazabilidad_stock_data',
        'trazabilidad_imported_batches', 'trazabilidad_recent_searches',
        'trazabilidad_dep_imported', 'trazabilidad_exp_imported'
      ];
      keys.forEach(function (k) { localStorage.removeItem(k); });
      window.history.replaceState({}, '', window.location.pathname);
      window.location.reload();
    }
  } catch (e) { }
})();

// Script 2: Set global reset flag
if (new URLSearchParams(window.location.search).get('reset') === '1') {
  window.__TRZ_RESET = 1;
}

// Script 3: Version check - force reload if build hash changed
(function () {
  try {
    if (window.__TRZ_VER_CHECKED) return;
    window.__TRZ_VER_CHECKED = true;
    var links = document.querySelectorAll('script[src*="_next"]');
    var hashes = [];
    links.forEach(function (s) { var m = s.src.match(/[a-f0-9]{8,}/); if (m) hashes.push(m[0]); });
    var ver = hashes.join('_');
    var prev = sessionStorage.getItem('_trz_v');
    if (prev && prev !== ver) {
      sessionStorage.setItem('_trz_v', ver);
      window.location.reload(true);
    } else if (!prev) {
      sessionStorage.setItem('_trz_v', ver);
    }
  } catch (e) { }
})();
