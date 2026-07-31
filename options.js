const el = (id) => document.getElementById(id);
function melden(t){ el("status").textContent = t; if(t) setTimeout(()=>el("status").textContent="",2500); }

chrome.storage.local.get(["url","intervall","dauerhaft"]).then((s)=>{
  el("url").value = s.url || "";
  el("intervall").value = String(s.intervall || 180);
  el("dauerhaft").checked = s.dauerhaft !== false;
});

el("speichern").addEventListener("click", async ()=>{
  const u = el("url").value.trim();
  if (!/^https:\/\/www\.ris\.bka\.gv\.at\//i.test(u)) { melden("Nur Adressen auf www.ris.bka.gv.at"); return; }
  await chrome.storage.local.set({ url: u }); melden("gespeichert");
});
el("standard").addEventListener("click", async ()=>{
  const a = await chrome.runtime.sendMessage({ typ:"STANDARD_URL" });
  el("url").value = a.url; await chrome.storage.local.set({ url: a.url }); melden("eingesetzt");
});
el("intervall").addEventListener("change", async ()=>{
  await chrome.storage.local.set({ intervall: Number(el("intervall").value) });
  await chrome.runtime.sendMessage({ typ:"INTERVALL_GEAENDERT" }); melden("gespeichert");
});
el("dauerhaft").addEventListener("change", async ()=>{
  await chrome.storage.local.set({ dauerhaft: el("dauerhaft").checked }); melden("gespeichert");
});
el("test").addEventListener("click", async ()=>{
  melden("läuft \u2026");
  const b = await chrome.runtime.sendMessage({ typ:"JETZT_PRUEFEN" });
  el("ausgabe").textContent = JSON.stringify(b, null, 2);
  melden("");
});
el("reset").addEventListener("click", async ()=>{
  await chrome.runtime.sendMessage({ typ:"ZURUECKSETZEN" }); melden("Bestand gelöscht");
});

el("kopieren").addEventListener("click", async ()=>{
  try { await navigator.clipboard.writeText(el("ausgabe").textContent); melden("kopiert"); }
  catch(e){ melden("Kopieren nicht möglich"); }
});
