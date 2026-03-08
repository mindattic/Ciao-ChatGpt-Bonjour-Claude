# Copilot Instructions

## Project Guidelines
- Whenever README.md is updated, README.htm must also be updated to stay in sync. README.htm is a standalone HTML version of README.md with all CSS and JS inline and CSS-rendered UI mockup screenshots of the exporter and importer overlays.
- The CSS styles in ChatGPTConversationExporter.js and ClaudeConversationImporter.js must stay visually aligned. Both overlays share the same color palette (blue-to-green gradient: `#6c63ff` → `#4ade80`), dark background (`#1a1a2e`), and overall UI structure. If you change colors, fonts, border-radius, or layout in one file, apply the same change to the other.
- Both ChatGPTConversationExporter.js and ClaudeConversationImporter.js contain a `Last Updated:` timestamp in their overlay HTML. Whenever either file is edited, update the timestamp in that file to the current local date/time in ISO 8601 format (`YYYY-MM-DDTHH:MM:SSZ`).