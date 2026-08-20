importScripts("lib.js");

const STANDARD_URL = "https://www.ris.bka.gv.at/Ergebnis.wxe?Abfrage=Gesamtabfrage&SearchInAsylGH=True&SearchInAvn=False&SearchInAvsv=False&SearchInBegut=False&SearchInBgblAlt=False&SearchInBgblAuth=False&SearchInBgblPdf=False&SearchInBks=True&SearchInBundesnormen=False&SearchInBvb=False&SearchInBvwg=True&SearchInDok=True&SearchInDsk=True&SearchInEat=False&SearchInErlaesse=False&SearchInGbk=True&SearchInGemeinderecht=False&SearchInGemeinderechtAuth=False&SearchInJustiz=False&SearchInKmGer=False&SearchInLandesnormen=False&SearchInLvwg=True&SearchInLgbl=False&SearchInLgblNO=False&SearchInLgblAuth=False&SearchInMrp=False&SearchInNormenliste=False&SearchInPruefGewO=False&SearchInPvak=True&SearchInRegV=False&SearchInSpg=False&SearchInUbas=True&SearchInUmse=True&SearchInUpts=True&SearchInUvs=True&SearchInVbl=False&SearchInVerg=True&SearchInVfgh=True&SearchInVwgh=True&ImRisSeitVonDatum=&ImRisSeitBisDatum=&ImRisSeit=&ResultPageSize=100&Suchworte=DSGVO&Position=1&Sort=2%7cDesc";

const STANDARD_INTERVALL = 180; // Minuten

const hole = (k, f) => chrome.storage.local.get(k).then((o) => (o[k] === undefined ? f : o[k]));
const setze = (o) => chrome.storage.local.set(o);

async function badgeSetzen() {
  const neu = await hole("neu", []);
  await chrome.action.setBadgeText({ text: neu.length ? String(neu.length) : "" });
  await chrome.action.setBadgeBackgroundColor({ color: "#B4650C" });
}

async function alarmSetzen(forceReset = false) {
  const min = await hole("intervall", STANDARD_INTERVALL);
  const existing = await chrome.alarms.get("pruefen");
  // Nur neu anlegen, wenn keiner existiert oder das Intervall geändert wurde
  // (forceReset = true bei Intervall-Änderung oder explizitem Reset)
  if (forceReset || !existing || existing.periodInMinutes !== min) {
    await chrome.alarms.clear("pruefen");
    await chrome.alarms.create("pruefen", {
      periodInMinutes: min,
      delayInMinutes: 1,
      persistAcrossSessions: true
    });
  }
}

/** Stellt sicher, dass der periodische Alarm existiert (wichtig nach SW-Neustart). */
async function ensureAlarm() {
  const existing = await chrome.alarms.get("pruefen");
  if (!existing) {
    await alarmSetzen(true);
  }
}

/* ---------- Kern: abrufen, vergleichen, melden ---------- */

/**
 * Fetch mit Retry. Fängt typische Startup-Fehler ab
 * („Failed to fetch“, wenn Netzwerk/Cookie-Store nach Browser-Start
 * noch nicht bereit sind).
 */
async function fetchMitRetry(url, versuche = 3) {
  let letzterFehler = null;
  for (let i = 0; i < versuche; i++) {
    try {
      const antwort = await fetch(url, {
        credentials: "include",
        cache: "no-store",
        redirect: "follow",
        headers: { "Accept": "text/html,application/xhtml+xml" }
      });
      return antwort;
    } catch (e) {
      letzterFehler = e;
      // Kurze Pause vor dem nächsten Versuch (exponentiell, max. ~3–4 s)
      if (i < versuche - 1) {
        await new Promise((r) => setTimeout(r, 700 * Math.pow(2, i)));
      }
    }
  }
  throw letzterFehler;
}

async function pruefen(diagnose = false) {
  const url = await hole("url", STANDARD_URL);
  const bericht = { zeit: Date.now(), url };

  let html = "";
  try {
    // Cookies mitsenden: Ergebnis.wxe ist eine WXE-Anwendung und braucht
    // in der Regel eine Sitzung, sonst kommt nur das Suchformular zurück.
    // Nach Browser-Neustart kann der erste Fetch scheitern → Retry.
    const antwort = await fetchMitRetry(url, 3);
    bericht.status = antwort.status;
    bericht.endgueltigeUrl = antwort.url;
    bericht.umgeleitet = antwort.redirected;
    html = await antwort.text();
    bericht.laenge = html.length;
    if (!antwort.ok) throw new Error("HTTP " + antwort.status);
  } catch (e) {
    bericht.fehler = String(e && e.message ? e.message : e);
    await setze({ letzterLauf: bericht.zeit, letzterFehler: bericht.fehler, diagnose: bericht });
    await badgeSetzen();
    return bericht;
  }

  const dokumente = dokumenteAusHtml(html);
  bericht.gefunden = dokumente.length;
  bericht.erste = dokumente.slice(0, 3).map((d) => d.nr);
  Object.assign(bericht, seitenBefund(html));

  if (!dokumente.length) {
    bericht.fehler = "Keine Dokumentnummern in der Antwort gefunden";
    bericht.beispielLinks = ersteLinks(html);
    bericht.textauszug = auszug(html);
    await setze({ letzterLauf: bericht.zeit, letzterFehler: bericht.fehler, diagnose: bericht });
    await badgeSetzen();
    return bericht;
  }

  const bekannt = await hole("bekannt", []);
  const bekanntSet = new Set(bekannt);
  const spitze = dokumente[0].nr;
  const vorherigeSpitze = await hole("spitze", null);

  // Erster Lauf: nur Bestand aufnehmen, nicht melden
  if (!bekannt.length) {
    await setze({
      bekannt: dokumente.map((d) => d.nr),
      spitze,
      bestand: dokumente.length,
      letzterLauf: bericht.zeit,
      letzterFehler: null,
      diagnose: bericht
    });
    bericht.hinweis = "Erster Lauf - Bestand aufgenommen, keine Meldung";
    await badgeSetzen();
    return bericht;
  }

  const neuGefunden = dokumente.filter((d) => !bekanntSet.has(d.nr));
  bericht.neu = neuGefunden.length;
  bericht.spitzeGeaendert = spitze !== vorherigeSpitze;

  if (neuGefunden.length) {
    const neuAlt = await hole("neu", []);
    const neuGesamt = [...neuGefunden, ...neuAlt]
      .filter((d, i, a) => a.findIndex((x) => x.nr === d.nr) === i)
      .slice(0, 100);
    await setze({
      bekannt: [...dokumente.map((d) => d.nr), ...bekannt].slice(0, 1000),
      spitze,
      neu: neuGesamt,
      bestand: dokumente.length,
      letzterLauf: bericht.zeit,
      letzterFehler: null,
      diagnose: bericht
    });
    await melden(neuGefunden);
  } else {
    await setze({
      spitze,
      bestand: dokumente.length,
      letzterLauf: bericht.zeit,
      letzterFehler: null,
      diagnose: bericht
    });
  }

  await badgeSetzen();
  return bericht;
}

async function melden(neue) {
  const n = neue.length;
  const kopf = n === 1 ? "1 neue Entscheidung" : n + " neue Entscheidungen";
  const zeilen = neue.slice(0, 4).map((d) => "\u2022 " + d.titel).join("\n");
  const rest = n > 4 ? "\n\u2026 und " + (n - 4) + " weitere" : "";
  const dauerhaft = await hole("dauerhaft", true);
  const id = "ris-" + Date.now();
  await chrome.notifications.create(id, {
    type: "basic",
    iconUrl: chrome.runtime.getURL("icons/128.png"),
    title: "RIS-Judikatur - " + kopf,
    message: zeilen + rest,
    priority: 2,
    requireInteraction: dauerhaft
  });
  // Wenn nicht dauerhaft: nach konfigurierter Zeit automatisch schließen
  if (!dauerhaft) {
    const sek = await hole("notifDauer", 60);
    // Alarm mit kurzer Verzögerung (chrome.alarms arbeitet in Minuten, daher delayInMinutes)
    const delayMin = Math.max(sek / 60, 0.05); // mind. ~3 s
    chrome.alarms.create("notif-clear-" + id, { delayInMinutes: delayMin });
  }
}

/* ---------- Ereignisse ---------- */
chrome.runtime.onInstalled.addListener(async () => {
  if ((await hole("url", null)) === null) await setze({ url: STANDARD_URL });
  await alarmSetzen(true);
  await badgeSetzen();
  // Kurzer Verzug, damit der Service Worker und das Netzwerk bereit sind
  chrome.alarms.create("pruefen-startup", { delayInMinutes: 0.25 }); // ~15 s
});

chrome.runtime.onStartup.addListener(async () => {
  await alarmSetzen(true);
  await badgeSetzen();
  // Nach Browser-Neustart nicht sofort prüfen – Netzwerk/Cookies brauchen oft
  // ein paar Sekunden. Einmaliger Alarm nach ~20 s.
  chrome.alarms.create("pruefen-startup", { delayInMinutes: 0.35 }); // ~21 s
});

// Bei jedem Aufwachen des Service Workers den Alarm sicherstellen
ensureAlarm().catch(() => {});

chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === "pruefen" || a.name === "pruefen-startup") {
    pruefen();
  } else if (a.name.startsWith("notif-clear-")) {
    const id = a.name.slice("notif-clear-".length);
    chrome.notifications.clear(id);
  }
});

chrome.runtime.onMessage.addListener((n, absender, antwort) => {
  if (n.typ === "JETZT_PRUEFEN") { pruefen(true).then((b) => antwort(b)); return true; }
  if (n.typ === "INTERVALL_GEAENDERT") { alarmSetzen(true).then(() => antwort({ ok: true })); return true; }
  if (n.typ === "GELESEN") { setze({ neu: [] }).then(badgeSetzen).then(() => antwort({ ok: true })); return true; }
  if (n.typ === "BADGE_AKTUALISIEREN") { badgeSetzen().then(() => antwort({ ok: true })); return true; }
  if (n.typ === "ZURUECKSETZEN") {
    setze({ bekannt: [], neu: [], spitze: null, bestand: 0 }).then(badgeSetzen).then(() => antwort({ ok: true }));
    return true;
  }
  if (n.typ === "STANDARD_URL") { antwort({ url: STANDARD_URL }); return true; }
});

chrome.notifications.onClicked.addListener(async (id) => {
  if (!id.startsWith("ris-")) return;
  const url = await hole("url", STANDARD_URL);
  await chrome.tabs.create({ url });
  chrome.notifications.clear(id);
});
