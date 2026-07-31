# RIS-Judikatur Monitor

Browser-Erweiterung, die eine Abfrage im Rechtsinformationssystem des Bundes (RIS) überwacht und meldet, sobald eine neue Entscheidung vorliegt.

Das RIS kennt keine Benachrichtigungsfunktion. Wer wissen will, ob etwas Neues da ist, muss nachsehen. Diese Erweiterung übernimmt das: Sie ruft in einem einstellbaren Abstand eine RIS-Trefferliste ab, vergleicht sie mit dem letzten Stand und zeigt neue Entscheidungen als Systembenachrichtigung an - mit Gericht, Datum, Geschäftszahl und direktem Link ins Dokument.

Voreingestellt ist eine Gesamtabfrage über DSB, BVwG, VwGH, VfGH, LVwG und weitere Anwendungen mit dem Suchwort „DSGVO". Die Abfrage lässt sich frei ändern, das Werkzeug ist daher nicht auf den Datenschutz beschränkt.

## Installation

1. Das Archiv herunterladen und in einen **dauerhaften** Ordner entpacken - nicht in den Temp- oder Downloadordner. Entpackte Erweiterungen lesen bei jedem Browserstart von der Platte.
2. Im Browser `chrome://extensions` beziehungsweise `brave://extensions` oder `edge://extensions` öffnen.
3. Entwicklermodus einschalten.
4. „Entpackte Erweiterung laden" und den entpackten Ordner wählen. Darin muss `manifest.json` unmittelbar liegen.

Empfehlenswert: die Erweiterung an die Symbolleiste anheften, sonst ist der Zähler für neue Entscheidungen nicht sichtbar.

Getestet mit Brave und Chrome. Läuft auf allen Chromium-Browsern, die Manifest V3 unterstützen, also auch Edge und Vivaldi.

## Erster Lauf

Der erste Abruf startet eine Minute nach dem Laden und **benachrichtigt bewusst nicht** - er nimmt nur den vorhandenen Bestand auf. Erst ab dem zweiten Lauf gibt es Meldungen. Andernfalls käme beim Installieren sofort eine Benachrichtigung über sämtliche Alteinträge.

„0 neu" nach dem ersten Lauf ist also der erwartete Zustand, kein Fehler.

## Eigene Abfrage einstellen

Rechtsklick auf das Symbol, dann Optionen.

Im Feld „Abfrage" steht die vollständige Adresse einer RIS-Trefferliste. Um sie zu ändern: die gewünschte Suche im RIS zusammenstellen, die Ergebnisseite aufrufen und deren Adresse aus der Adresszeile hier einfügen.

Zwei Punkte dabei:

- Die Sortierung muss **absteigend** bleiben, sonst steht die neueste Entscheidung nicht an erster Stelle.
- Eine großzügige Trefferzahl je Seite (etwa 100) ist sinnvoll, damit auch mehrere neue Entscheidungen zwischen zwei Läufen erkannt werden.

Über die Schaltfläche „Standardabfrage einsetzen" lässt sich jederzeit die Voreinstellung wiederherstellen.

## Prüfintervall

Wählbar unter Optionen: 30 Minuten, stündlich, 3 Stunden, 6 Stunden, 12 Stunden, täglich.

Voreingestellt sind drei Stunden. Das RIS wird an Werktagen befüllt und in der Regel nicht mehrmals pro Stunde; häufigeres Abfragen bringt kaum Aktualität, erzeugt aber zusätzliche Last auf einem Dienst, den man höflich behandeln sollte. Das RIS bittet ausdrücklich darum, regelmäßige automatisierte Abfragen zu melden, wenn sie ins Gewicht fallen - bei acht Abrufen am Tag von einem einzelnen Arbeitsplatz ist das nicht der Fall.

## Datenschutz und Berechtigungen

Die Erweiterung sendet nichts nach außen. Alle Daten bleiben lokal in `chrome.storage.local`. Kein Tracking, keine Analysefunktion, keine externen Schriften, Bibliotheken oder Bilder.

Benötigt werden drei Berechtigungen:

| Berechtigung | wofür |
|---|---|
| `alarms` | zeitgesteuerter Abruf im eingestellten Intervall |
| `notifications` | Anzeige der Systembenachrichtigung |
| `storage` | lokale Ablage der bereits bekannten Dokumentnummern |

Dazu Zugriff auf genau eine Domain: `https://www.ris.bka.gv.at/*`.

Der Quellcode besteht aus sechs Dateien und ist in einer Viertelstunde gelesen.

## Wie neue Entscheidungen erkannt werden

Nicht über die Gestaltung der Ergebnisseite, sondern über den RIS-Parameter `Dokumentnummer` in den Trefferverweisen. Das ist die stabile Kennung eines Dokuments; eine Umgestaltung der RIS-Oberfläche bricht die Erkennung daher nicht.

Verglichen wird nicht nur der erste Treffer, sondern die gesamte abgerufene Liste gegen den gespeicherten Bestand. Erscheinen zwischen zwei Läufen mehrere Entscheidungen, werden alle gemeldet.

Der angezeigte Titel wird aus der Dokumentnummer abgeleitet: Aus `BVWGT_20260713_W298_2343608_1_00` wird „Bundesverwaltungsgericht - 13.07.2026 - W298 2343608 1".

## Wenn nichts gefunden wird

Unter Optionen gibt es eine Diagnose. „Prüfung starten" zeigt HTTP-Status, Zieladresse nach etwaiger Umleitung, Antwortgröße, die Zahl erkannter Dokumentnummern und - falls keine gefunden wurden - die ersten Verweise der Seite sowie einen Textauszug der Antwort.

Steht dort eine Zahl größer null, funktioniert alles. Andernfalls hilft die Ausgabe bei der Eingrenzung; sie lässt sich über „Ausgabe kopieren" weitergeben.

Über „Bestand löschen" wird die Liste bekannter Dokumente zurückgesetzt. Der nächste Lauf nimmt den Bestand dann neu auf, ohne zu benachrichtigen.

## Ergänzend

Für die Weiterverarbeitung der Fundstellen gibt es [shrinkwrap.legal](https://shrinkwrap.legal/), das RIS-Verweise in eine handlichere Form bringt. Ein unabhängiges Angebot Dritter, das mit dieser Erweiterung in keinem Zusammenhang steht - Nutzung auf eigene Verantwortung.

## Haftungsausschluss

Die Erweiterung wird unentgeltlich und ohne Gewähr zur Verfügung gestellt.

Sie ersetzt keine eigene Recherche im RIS und begründet keine Zusicherung, dass neue Entscheidungen vollständig, richtig oder rechtzeitig erkannt werden. Die Verantwortung für Fristen, Recherche und die daraus gezogenen Schlüsse bleibt beim Anwender.

Das RIS ist ein Angebot des Bundeskanzleramts. Diese Erweiterung steht damit in keinem Zusammenhang und wird vom Bundeskanzleramt weder betrieben noch unterstützt.

## Lizenz

MIT - siehe [LICENSE](LICENSE).

Copyright (c) 2026 Dietmar Mühlböck
