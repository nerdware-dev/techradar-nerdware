##Notion Page
[Link zur Notion Page](https://www.notion.so/nerdware/Techradar-063f46f06b764e20a5fa610e024c64b4?pvs=4)

## How To Use

Den Inhalt des Radars kann in GitHub direkt unter ./Data/tech-radar.json gepflegt werden.
Beim Hinzufügen von neuen Punkten muss der Aufbau genau eingehalten werden, da das Techradar sonst nicht generiert werden kann.

Folgende Werte müssen ausgefüllt werden:

**_"name":_** Hier kann der Name der Technologie angegeben werden. <br>

**_"ring":_** Insgesamt gibt es vier verschiedene Ringe angeben, in denen die Technologie eingeordnet werden soll. <br> <h3>1. low</h3> <p>Low Experience (Geringe Erfahrung) / Upcoming Stars: Dieser Bereich umfasst Technologien, Skills oder Praktiken, mit denen Ihr Unternehmen bisher nur begrenzte Erfahrungen gesammelt hat. Es sind Bereiche, die möglicherweise für zukünftige Projekte oder strategische Richtungen von Interesse sind, in denen Ihr Team aber derzeit noch nicht stark ist. Diese Kategorie hilft dabei, potenzielle Wachstumsbereiche zu identifizieren, in denen weitere Exploration und Entwicklung erforderlich sind.</p>

<br> <h3> 2. dev</h3> <p>Developing (Im Aufbau): Hier werden Technologien, Skills oder Praktiken eingeordnet, die Sie aktiv entwickeln und fördern. Dieser Bereich umfasst Fähigkeiten, in die investiert wird, sei es durch Schulungen, Projekte oder durch die Einstellung neuer Mitarbeiter mit diesen Kompetenzen. Es handelt sich um Bereiche, die Sie für wichtig halten und die sich in einer aktiven Phase der Kompetenzsteigerung befinden.</p> </h3><br><h3> 3. high </h3><p>High Competency (Hohe Kompetenz): In diesen Bereich fallen Technologien, Skills oder Praktiken, bei denen Ihr Unternehmen eine starke Expertise und umfangreiche Erfahrung aufgebaut hat. Diese Kompetenzen sind ein Kernbestandteil Ihrer aktuellen Projekte und Prozesse und tragen wesentlich zum Erfolg Ihres Unternehmens bei. Sie repräsentieren Bereiche, in denen Sie führend sind oder einen deutlichen Wettbewerbsvorteil haben.</p> <br> <h3>4. old </h3><p>No Longer Used (Nicht mehr genutzt): In diese Kategorie fallen Technologien, Skills oder Praktiken, die in der Vergangenheit vielleicht einmal relevant waren, aber nicht mehr den Anforderungen Ihres Unternehmens entsprechen oder durch effektivere Methoden ersetzt wurden. Dies umfasst veraltete Technologien oder Fähigkeiten, von denen Sie sich bewusst entschieden haben, sie nicht weiter zu verfolgen oder zu pflegen.</p> <br>

**_"quadrant":_** Im Feld Quadrant kann man die Technologie nocheinmal in verschiedene Kategorieren unterglieden. Es gibt vier zur Auswahl. <br> 1. techniques <br> 2. platforms <br> 3. tools <br> 4. languages & frameworks <br>

**_"isNew":_** Es kann "TRUE" oder "FALSE" angegeben werden. Sollte man "TRUE" angeben, wird der Eintrag mit einem Ring gekennzeichnet. <br>

**_"description":_** Hier kann man zu den jeweiligen Technologien eine Beschreibung hinzufügen. Durch das Einfügen von "<a href>" kann man hier einen Link miteinfügen. <br>

## Beispieleintrag

{ <br>
"name": "Neue Technologie", <br>
"ring": "high", <br>
"quadrant": "techniques", <br>
"isNew": "TRUE", <br>
"description": "Das ist eine Beispielbeschreibung. " <br>
}

## Anpassung des Quellcodes

Ändert man etwas am Quellcode muss man erneute statische Website generieren.
Das funktioniert folgendermaßen:

1. **_npm i_** ausführen
2. **_npm run build:dev_** ausführen. Dadurch wird der Ordner "Docs" aktualisiert.
   !! Es wird die dev Version verwendet, da hier bereits das neue Design von Thoughtworks für das Radar verwendet wird !!

Da Github Pages Probleme mit den Pfadangaben hat, muss man an einigen Stellen noch "./" vor "images/..." zum Pfad hinzufügen.
Im Dokument ./Docs/index.html in folgenden Zeilen:

Zeile 6: link href="./images/favicon.ico" rel="icon" <br>
Zeile 12: href="./main.8b265bb19ea3a3919f40.css" rel="stylesheet" <br>
Zeile 18: img src="./images/logo-nw.png" alt="Nerdware logo" <br>
Zeile 69: script defer src="./main.e67352f84492fd84252e.js"

Dokument main."Zeichenfolge".js

Zeile: module.exports = **webpack_require**.p + "./images/new.svg";
Zeile: module.exports = **webpack_require**.p + "./images/no-change.svg";
