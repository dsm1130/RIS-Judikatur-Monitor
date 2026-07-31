function zeit(ms){ return ms ? new Date(ms).toLocaleString("de-AT",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}) : "noch keine Prüfung"; }
function esc(s){ return String(s).replace(/[<>&"]/g, c => ({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;"}[c])); }

async function zeichnen(){
  const s = await chrome.storage.local.get(["neu","letzterLauf","letzterFehler","bestand","spitze"]);
  const neu = s.neu || [];
  document.getElementById("meta").textContent =
    `${neu.length} neu \u00b7 ${s.bestand||0} Treffer in der Abfrage \u00b7 zuletzt ${zeit(s.letzterLauf)}`;
  document.getElementById("fehler").innerHTML =
    s.letzterFehler ? `<div class="fehler">${esc(s.letzterFehler)}</div>` : "";
  const liste = document.getElementById("liste");
  liste.innerHTML = neu.length
    ? neu.map(d => `<div class="e"><a href="${esc(d.url)}" target="_blank" rel="noreferrer">${esc(d.titel)}</a><div class="nr">${esc(d.nr)}</div></div>`).join("")
    : '<div class="leer">Keine neuen Entscheidungen.</div>';
}

document.getElementById("pruefen").addEventListener("click", async (ev) => {
  ev.target.disabled = true; ev.target.textContent = "prüfe \u2026";
  await chrome.runtime.sendMessage({ typ: "JETZT_PRUEFEN" });
  ev.target.disabled = false; ev.target.textContent = "Jetzt prüfen";
  zeichnen();
});
document.getElementById("gelesen").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ typ: "GELESEN" }); zeichnen();
});
document.getElementById("oeffnen").addEventListener("click", async () => {
  const s = await chrome.storage.local.get("url");
  if (s.url) chrome.tabs.create({ url: s.url });
});
zeichnen();
