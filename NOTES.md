# Rabbithole Development Notes

## Session: December 26-27, 2025 (Block ~21,098,433)

### What We Built
Extracted Rabbithole from arthel into a standalone repo:
- **Repo**: https://github.com/magent-cryptograss/rabbithole
- **Philosophy**: "discover music by connections, not algorithms"

### Architecture
```
src/
├── index.js           # RabbitholePlayer - main coordinator
├── state.js           # RabbitholeState - following/queueing/history with localStorage
├── catalog.js         # CatalogAPI interface + StaticCatalog + PickiPediaCatalog
├── player/
│   └── webamp-chartifacts.js  # 2000-line Webamp visualization (needs cleanup)
└── styles/
    └── rabbithole.css
```

### Current State
- Vite build configured
- Demo page at index.html runs on port 4000
- **Problem**: Demo shows "Loading player" - needs debugging
  - Demo catalog has placeholder audio URL (justinholmes.com)
  - WebampChartifacts may have initialization issues without real audio

### Next Steps
1. **Debug player loading** - Check browser console, possibly use Vibium for visual debugging
2. **Real audio** - Either point to actual audio files or set up PickiPedia catalog
3. **PickiPedia integration** - Add SMW properties for rabbithole track data:
   - `Has rabbithole data::true`
   - `Has audio file::`
   - `Has duration::`
   - `Has ensemble::` (JSON or structured)
   - `Has timeline::` (JSON)
4. **Refactor WebampChartifacts** - Break 2000-line monolith into:
   - webamp.js (Webamp integration)
   - ensemble.js (musician card display)
   - timeline.js (parts/timeline visualization)
   - effects.js (flourish, spotlight, band flash)

### Pending from PickiPedia
- SMW deprecation warnings suppressed (but still occurring - SMW 6.0 + MW 1.45 mismatch)
- Video playback via TimedMediaHandler may need testing
- rsync exclude for `.smw.json` needs ansible deploy

### Related
- **Vibium**: AI-native browser automation tool mentioned by Simon Stewart (Selenium creator)
  - Could help debug player loading issues
  - Worth exploring for Rabbithole testing
- **arthel PR #5**: December work (setstones gallery, ASCII banners) waiting for merge
