# 🐰 Rabbithole

**Discover music by connections, not algorithms.**

Rabbithole is a music player that lets you follow musicians through their discographies. Click on a musician, see what else they've played on, and go down the rabbithole.

## Philosophy

Most music discovery is algorithmic - "you might also like" based on listening patterns and statistical similarity. Rabbithole takes a different approach: **follow the humans**.

When you hear a guitarist you like, click their name. See what other sessions they've played on. Follow them to a different song, discover a new fiddler, follow them somewhere else. The connections are real - these musicians actually played together.

## Features

- **Real-time visualization** - See who's playing what, when, as the song progresses
- **Musician following** - Place a 🐰 on any musician and auto-queue their other recordings
- **Connection browsing** - Click any musician to see their full discography
- **PickiPedia integration** - Links to wiki pages for deep dives on musicians
- **Webamp-powered** - Nostalgic Winamp-style interface
- **Embeddable** - Drop it into any page via iframe or web component

## Quick Start

```html
<script type="module">
  import { RabbitholePlayer, PickiPediaCatalog } from '@cryptograss/rabbithole';

  const player = new RabbitholePlayer({
    containerId: 'player',
    catalog: new PickiPediaCatalog({
      baseUrl: 'https://pickipedia.xyz'
    })
  });

  await player.init();
  player.playSong('august');
</script>

<div id="player"></div>
```

## Catalog Sources

Rabbithole needs a catalog of songs with timeline/ensemble data. Two built-in options:

### PickiPediaCatalog

Fetches data from a PickiPedia (Semantic MediaWiki) instance:

```javascript
import { PickiPediaCatalog } from '@cryptograss/rabbithole/catalog';

const catalog = new PickiPediaCatalog({
  baseUrl: 'https://pickipedia.xyz'
});
```

### StaticCatalog

For testing or embedding with pre-baked data:

```javascript
import { StaticCatalog } from '@cryptograss/rabbithole/catalog';

const catalog = new StaticCatalog({
  'august': {
    title: 'August',
    audioFile: '/audio/august.mp3',
    duration: 245,
    ensemble: {
      'Justin Holmes': ['guitar'],
      'Cory Walker': ['banjo']
    },
    timeline: { /* ... */ }
  }
});
```

## Track Data Format

Each track needs:

```typescript
interface RabbitholeTrack {
  title: string;
  slug: string;
  audioFile: string;          // URL to audio
  duration: number;           // seconds
  ensemble: {                 // musician -> instruments
    [musicianName: string]: string[];
  };
  timeline: {                 // musical events by timestamp
    [timestamp: string]: TimelineEvent;
  };
  standardSectionLength?: number;
  colorScheme?: ColorScheme;
  // Optional metadata
  engineer?: string;
  studio?: string;
  recordDate?: string;
  release?: string;
}
```

## Development

```bash
npm install
npm run dev     # Start dev server
npm run build   # Build for production
npm run test    # Run tests
```

## Project Structure

```
rabbithole/
├── src/
│   ├── index.js           # Main entry point
│   ├── state.js           # RabbitholeState - following/queueing logic
│   ├── catalog.js         # CatalogAPI + implementations
│   ├── player/
│   │   ├── index.js       # WebampChartifacts player
│   │   ├── ensemble.js    # Ensemble display component
│   │   ├── timeline.js    # Timeline/parts visualization
│   │   └── webamp.js      # Webamp integration
│   └── styles/
│       └── rabbithole.css
├── index.html             # Demo/dev page
├── package.json
└── vite.config.js
```

## Related Projects

- [PickiPedia](https://pickipedia.xyz) - Traditional music knowledge base
- [CryptoGrass](https://cryptograss.live) - Bluegrass meets blockchain
- [Webamp](https://webamp.org) - Winamp reimplemented in the browser

## License

MIT
