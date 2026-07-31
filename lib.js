/* Gemeinsame Hilfsfunktionen. Wird von background.js importiert. */

const RIS_BASIS = "https://www.ris.bka.gv.at/";

const BEHOERDE = {
  DSBT:"Datenschutzbehörde", DSB:"Datenschutzbehörde", DSK:"Datenschutzkommission",
  BVWGT:"Bundesverwaltungsgericht", BVWG:"Bundesverwaltungsgericht",
  JWT:"Verwaltungsgerichtshof", JWR:"Verwaltungsgerichtshof (Rechtssatz)",
  JFT:"Verfassungsgerichtshof", JFR:"Verfassungsgerichtshof (Rechtssatz)",
  LVWGT:"Landesverwaltungsgericht", LVWG:"Landesverwaltungsgericht",
  GBKT:"Gleichbehandlungskommission", PVAKT:"Personalvertretungsaufsichtsbehörde",
  UPTST:"Unabhängiger Parteien-Transparenz-Senat", BKST:"Bundeskommunikationssenat",
  VERGT:"Vergabekontrolle", ASYLGHT:"Asylgerichtshof", UBAST:"Unabhängiger Bundesasylsenat",
  UVST:"Unabhängiger Verwaltungssenat", UMSET:"Umsetzung EU-Recht", DOKT:"Dokumentation",
  JJT:"Justiz", JJR:"Justiz (Rechtssatz)"
};

/* Liest die Dokumente in ihrer Reihenfolge aus dem HTML.
   Drei Muster werden nacheinander versucht, damit die Erkennung nicht
   an einer einzelnen Schreibweise hängt. */
function dokumenteAusHtml(html) {
  const treffer = [];
  const gesehen = new Set();
  const nimm = (nr, href) => {
    if (!nr || gesehen.has(nr)) return;
    gesehen.add(nr);
    treffer.push({ nr, url: href ? absolut(entschaerfen(href)) : dokumentUrl(nr), titel: titelAusNummer(nr) });
  };

  // Muster 1: Verweise mit Parameter Dokumentnummer
  let m, re = /href\s*=\s*["']([^"']*[?&]Dokumentnummer=([A-Za-z0-9_.\-]+)[^"']*)["']/gi;
  while ((m = re.exec(html)) !== null) nimm(m[2], m[1]);

  // Muster 2: Pfadform /Dokumente/<Anwendung>/<Nummer>/
  if (!treffer.length) {
    re = /href\s*=\s*["']([^"']*\/Dokumente\/[A-Za-z0-9]+\/([A-Za-z0-9_.\-]+)\/[^"']*)["']/gi;
    while ((m = re.exec(html)) !== null) nimm(m[2], m[1]);
  }

  // Muster 3: nackte Dokumentnummern irgendwo im Text
  if (!treffer.length) {
    re = /[?&]Dokumentnummer=([A-Za-z0-9_.\-]+)/gi;
    while ((m = re.exec(html)) !== null) nimm(m[1], null);
  }

  return treffer;
}

/* Zusatzangaben für die Diagnose: Sieht die Antwort überhaupt nach einer
   RIS-Trefferliste aus, und wie viele Treffer meldet die Seite selbst? */
function seitenBefund(html) {
  const b = {};
  b.istRisSeite = /Rechtsinformationssystem|ris\.bka\.gv\.at/i.test(html);
  b.hatSuchformular = /Suchformular|Suchworte/i.test(html);
  b.hatKeineTreffer = /keine\s+Dokumente|kein\s+Dokument\s+gefunden|Es\s+wurden\s+keine/i.test(html);
  b.hatSitzungshinweis = /Sitzung|Session\s*(abgelaufen|timeout)|WxeFunctionToken/i.test(html);
  const t = html.match(/(\d[\d.\s]*)\s*(?:Treffer|Dokumente?\b)/i);
  b.trefferText = t ? t[0].replace(/\s+/g, " ").trim() : null;
  const v = html.match(/von\s+([\d.]+)\s*(?:Treffer|Dokumente?)/i);
  b.gesamtText = v ? v[0] : null;
  return b;
}

/* Lesbarer Auszug für die Diagnose: Skripte und Stile raus, Tags weg. */
function auszug(html, max = 1800) {
  const roh = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return roh.slice(0, max);
}

/* Erste Verweise im Rohzustand - zeigt, wie die Trefferlinks aufgebaut sind. */
function ersteLinks(html, anzahl = 8) {
  const out = [];
  const re = /href\s*=\s*["']([^"']{10,200})["']/gi;
  let m;
  while ((m = re.exec(html)) !== null && out.length < anzahl) {
    const h = m[1];
    if (/\.(css|js|png|gif|jpg|svg|ico)(\?|$)/i.test(h)) continue;
    if (/^(#|javascript:|mailto:)/i.test(h)) continue;
    out.push(entschaerfen(h));
  }
  return out;
}

function entschaerfen(s){ return s.replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'"); }
function absolut(href){ return /^https?:/i.test(href) ? href : RIS_BASIS + href.replace(/^\//,""); }
function dokumentUrl(nr){ return RIS_BASIS + "Dokument.wxe?Dokumentnummer=" + encodeURIComponent(nr); }

function titelAusNummer(nr) {
  const t = nr.split("_");
  const behoerde = BEHOERDE[t[0].toUpperCase()] || t[0];
  let datum = "";
  if (t[1] && /^\d{8}$/.test(t[1])) datum = t[1].slice(6,8)+"."+t[1].slice(4,6)+"."+t[1].slice(0,4);
  let gz = t.slice(2).join(" ").replace(/\s0+$/, "").trim();
  if (gz.length > 60) gz = gz.slice(0,57)+"...";
  return [behoerde, datum, gz].filter(Boolean).join(" - ");
}
