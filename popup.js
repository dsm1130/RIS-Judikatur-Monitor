function zeit(ms){ return ms ? new Date(ms).toLocaleString("de-AT",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}) : "noch keine Prüfung"; }
function esc(s){ return String(s).replace(/[<>&"]/g, c => ({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;"}[c])); }

async function zeichnen(){
  const s = await chrome.storage.local.get(["neu","letzterLauf","letzterFehler","bestand","spitze"]);
  const neu = s.neu || [];
  document.getElementById("meta").textContent =
    `${neu.length} neu \u00b7 ${s.bestand||0} Treffer in der Abfrage \u00b7 zuletzt ${zeit(s.letzterLauf)}`;
  document.getElementById("fehler").innerHTML =
    s.letzterFehler ? `<div class="fehler">${esc(s.letzterFehler)}</div>` : "";

  const leiste = document.getElementById("auswahlLeiste");
  const liste = document.getElementById("liste");
  const alleCb = document.getElementById("alleAuswaehlen");

  if (!neu.length) {
    leiste.style.display = "none";
    liste.innerHTML = '<div class="leer">Keine neuen Entscheidungen.</div>';
    return;
  }

  leiste.style.display = "flex";
  alleCb.checked = false;
  liste.innerHTML = neu.map((d, i) =>
    `<div class="e">
      <input type="checkbox" class="fund-cb" data-idx="${i}" id="cb-${i}">
      <div class="inhalt">
        <a href="${esc(d.url)}" target="_blank" rel="noreferrer" data-nr="${esc(d.nr)}">${esc(d.titel)}</a>
        <div class="nr">${esc(d.nr)}</div>
      </div>
    </div>`
  ).join("");

  // Event-Listener für Einzel-Checkboxen, damit "Alle" synchron bleibt
  liste.querySelectorAll(".fund-cb").forEach(cb => {
    cb.addEventListener("change", () => {
      const alle = [...liste.querySelectorAll(".fund-cb")];
      alleCb.checked = alle.every(c => c.checked);
      alleCb.indeterminate = !alleCb.checked && alle.some(c => c.checked);
    });
  });

  // Beim Öffnen eines einzelnen Funds diesen aus der „neu“-Liste entfernen
  liste.querySelectorAll("a[data-nr]").forEach(a => {
    a.addEventListener("click", async () => {
      const nr = a.dataset.nr;
      const s = await chrome.storage.local.get("neu");
      const rest = (s.neu || []).filter(d => d.nr !== nr);
      await chrome.storage.local.set({ neu: rest });
      await chrome.runtime.sendMessage({ typ: "BADGE_AKTUALISIEREN" });
      zeichnen();
    });
  });
}

document.getElementById("alleAuswaehlen").addEventListener("change", (ev) => {
  const checked = ev.target.checked;
  document.querySelectorAll(".fund-cb").forEach(cb => { cb.checked = checked; });
  ev.target.indeterminate = false;
});

document.getElementById("pruefen").addEventListener("click", async (ev) => {
  ev.target.disabled = true; ev.target.textContent = "prüfe \u2026";
  await chrome.runtime.sendMessage({ typ: "JETZT_PRUEFEN" });
  ev.target.disabled = false; ev.target.textContent = "Jetzt prüfen";
  zeichnen();
});

document.getElementById("oeffnenAuswahl").addEventListener("click", async () => {
  const s = await chrome.storage.local.get("neu");
  const neu = s.neu || [];
  const selectedIdx = new Set();
  document.querySelectorAll(".fund-cb:checked").forEach(cb => {
    selectedIdx.add(Number(cb.dataset.idx));
  });
  if (!selectedIdx.size) return;
  const selected = [];
  const rest = [];
  neu.forEach((d, i) => {
    if (selectedIdx.has(i)) selected.push(d);
    else rest.push(d);
  });
  for (const d of selected) {
    chrome.tabs.create({ url: d.url });
  }
  // Nach dem Öffnen aus der „neu“-Liste entfernen
  await chrome.storage.local.set({ neu: rest });
  await chrome.runtime.sendMessage({ typ: "BADGE_AKTUALISIEREN" });
  zeichnen();
});

document.getElementById("oeffnen").addEventListener("click", async () => {
  const s = await chrome.storage.local.get("url");
  if (s.url) chrome.tabs.create({ url: s.url });
});

zeichnen();
