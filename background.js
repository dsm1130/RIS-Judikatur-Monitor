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

async function alarmSetzen() {
  const min = await hole("intervall", STANDARD_INTERVALL);
  await chrome.alarms.clear("pruefen");
  chrome.alarms.create("pruefen", { periodInMinutes: min, delayInMinutes: 1 });
}

/* ---------- Kern: abrufen, vergleichen, melden ---------- */
async function pruefen(diagnose = false) {
  const url = await hole("url", STANDARD_URL);
  const bericht = { zeit: Date.now(), url };

  let html = "";
  try {
    // Cookies mitsenden: Ergebnis.wxe ist eine WXE-Anwendung und braucht
    // in der Regel eine Sitzung, sonst kommt nur das Suchformular zurueck.
    const antwort = await fetch(url, {
      credentials: "include",
      cache: "no-store",
      redirect: "follow",
      headers: { "Accept": "text/html,application/xhtml+xml" }
    });
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
  await chrome.notifications.create("ris-" + Date.now(), {
    type: "basic",
    iconUrl: chrome.runtime.getURL("icons/128.png"),
    title: "RIS-Judikatur - " + kopf,
    message: zeilen + rest,
    priority: 2,
    requireInteraction: await hole("dauerhaft", true)
  });
}

/* ---------- Ereignisse ---------- */
chrome.runtime.onInstalled.addListener(async () => {
  if ((await hole("url", null)) === null) await setze({ url: STANDARD_URL });
  await alarmSetzen();
  await badgeSetzen();
  pruefen();
});

chrome.runtime.onStartup.addListener(async () => {
  await alarmSetzen();
  await badgeSetzen();
});

chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === "pruefen") pruefen();
});

chrome.runtime.onMessage.addListener((n, absender, antwort) => {
  if (n.typ === "JETZT_PRUEFEN") { pruefen(true).then((b) => antwort(b)); return true; }
  if (n.typ === "INTERVALL_GEAENDERT") { alarmSetzen().then(() => antwort({ ok: true })); return true; }
  if (n.typ === "GELESEN") { setze({ neu: [] }).then(badgeSetzen).then(() => antwort({ ok: true })); return true; }
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
