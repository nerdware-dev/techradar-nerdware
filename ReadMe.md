## How To Use

Den Inhalt des Radars kann in GitHub direkt unter ./Data/tech-radar.json gepflegt werden.
Beim Hinzufügen von neuen Punkten muss der Aufbau genau eingehalten werden, da das Techradar sonst nicht generiert werden kann.

Folgende Werte müssen ausgefüllt werden:


**_"name":_** Hier kann der Name der Technologie angegeben werden <br>

**_"ring":_** Insgesamt gibt es vier verschiedene Ringe angeben, in denen die Technologie stehen soll <br>
        1. adopt <br>
        2. trial <br>
        3. assess <br>
        4. hold <br>

**_"quadrant":_** Im Feld Quadrant kann man die Technologie nocheinmal in verschiedene Kategorieren unterglieden. Es gibt vier zur Auswahl. <br>
        1. techniques <br>
        2. platforms <br>
        3. tools <br>
        4.languages & frameworks <br>

**_"isNew":_** Es kann "TRUE" oder "FALSE" angegeben werden. Sollte man "TRUE" angeben, wird der Eintrag mit einem Ring gekennzeichnet. <br>

**_"description":_** Hier kann man zu den jeweiligen Technologien eine Beschreibung hinzufügen. Durch das Einfügen von "<a href>" kann man hier einen Link miteinfügen. <br>

## Beispieleintrag
 { <br>
    "name": "Neue Technologie", <br>
    "ring": "hold", <br>
    "quadrant": "techniques", <br>
    "isNew": "TRUE", <br>
    "description": "Das ist eine Beispielbeschreibung. " <br>
  }

## Anpassung des Quellcodes

Ändert man etwas am Quellcode muss man, damit das Techradar auf GitHub Pages gehostet werden kann, eine statische Website generieren.
Das funktioniert folgendermaßen:

Erst npm i und danach npm run build:dev ausführen. Dadurch wird der Ordner "Docs" aktualisiert.
!! Es wird die dev Version verwendet, da hier bereits das neue Design verwendet wurde !!

Da Github Pages Probleme mit einigen Pfadangaben hat, muss man an einigen Stellen noch einen Punkt zum Pfad hinzufügen.

Im Dokument ./Docs/index.html in folgenden Zeilen:

Zeile 12: '<link href="./main.8b265bb19ea3a3919f40.css" rel="stylesheet"></head> '
Zeile 18: <img src="./images/logo-nw.png" alt="Nerdware logo" /></a>
Zeile 69: <script defer src="./main.e67352f84492fd84252e.js"></script></body>

