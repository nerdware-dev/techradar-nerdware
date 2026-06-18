# Nerdware Tech Radar

Der Nerdware Tech Radar gibt einen Überblick über Technologien, Tools, Plattformen und Methoden, die bei Nerdware eingesetzt, beobachtet oder abgelöst wurden.

[Link zur Notion-Dokumentation](https://www.notion.so/nerdware/Techradar-063f46f06b764e20a5fa610e024c64b4?pvs=4)

---

## Inhalt pflegen

Der Radar-Inhalt wird in `data/tech-radar.json` verwaltet. Die Datei kann direkt in GitHub bearbeitet werden.

### Eintrags-Format

```json
{
  "name": "Neue Technologie",
  "ring": "High",
  "quadrant": "tools",
  "isNew": true,
  "description": "Kurze Beschreibung. <a href=\"https://example.com\">Mehr erfahren</a>"
}
```

### Gültige Werte

| Feld       | Gültige Werte                                                |
| ---------- | ------------------------------------------------------------ |
| `ring`     | `Low`, `Dev`, `High`, `Out`                                  |
| `quadrant` | `techniques`, `platforms`, `tools`, `languages & frameworks` |
| `isNew`    | `true` / `false` (Boolean)                                   |

> Werte für `ring` und `quadrant` sind **case-insensitiv** — `high`, `HIGH` und `High` werden alle akzeptiert.
> Bei einem Tippfehler erscheint eine klare Fehlermeldung statt einem leeren Radar.

---

## Lokale Entwicklung

```bash
nvm use          # Node-Version aus .nvmrc verwenden
npm install      # Abhängigkeiten installieren
npm run dev      # Entwicklungsserver starten (http://localhost:5173)
```

---

## Tests & Linting

```bash
npm test             # Unit-Tests (Vitest + React Testing Library)
npm run test:e2e     # End-to-End-Tests (Playwright)
npm run lint         # ESLint + Prettier + TypeScript-Prüfung
```

---

## Build & Deployment

### Lokaler Build

```bash
npm run build    # Produktions-Build → dist/
```

### Docker

```bash
docker build -t techradar-nerdware .
docker run -p 8080:80 techradar-nerdware
```

Der Container verwendet nginx und ist unter `http://localhost:8080` erreichbar.

### CI/CD

Bei jedem Push auf `master` baut die GitHub Actions Pipeline automatisch das Docker-Image und pusht es in die Registry.

---

## Konfiguration

| Variable              | Beschreibung                                              | Standard                                                                                                                                                   |
| --------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_RADAR_DATA_URL` | URL zur Radar-JSON-Datei (kann auf externe Quelle zeigen) | `https://raw.githubusercontent.com/nerdware-dev/techradar-nerdware/master/data/tech-radar.json` (definiert in `src/config.ts`, überschreibbar via Env-Var) |

Beispiel für eine abweichende Datenquelle:

```bash
VITE_RADAR_DATA_URL=https://example.com/mein-radar.json npm run build
```
