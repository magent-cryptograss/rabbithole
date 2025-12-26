/**
 * Rabbithole State Management
 *
 * Handles the core "discover music by connections" logic:
 * - Following musicians through their discography
 * - Queueing songs
 * - Play history
 * - localStorage persistence
 */

export class RabbitholeState {
    constructor(options = {}) {
        this.followingMusician = null;      // The musician the rabbit is on
        this.playedSongs = new Set();       // Songs already played this session
        this.currentSongSlug = null;        // Current song being played
        this.followMode = 'same';           // 'same' (stay on musician), 'random' (hop to bandmate), 'manual'

        this.history = [];                   // Array of {songSlug, songTitle, viaMusician}
        this.nextSong = null;               // {songSlug, songTitle, viaMusician}
        this.queue = [];                    // Song slugs to play next

        // Callbacks
        this.onStateChange = options.onStateChange || (() => {});
        this.onNextSongQueued = options.onNextSongQueued || (() => {});

        // Catalog accessor - should be provided by the host
        this.getCatalog = options.getCatalog || (() => ({}));
        this.getConnections = options.getConnections || (async () => null);

        // Load saved state
        this.loadFromStorage();
    }

    /**
     * Save state to localStorage
     */
    saveToStorage() {
        try {
            const toSave = {
                followingMusician: this.followingMusician,
                playedSongs: Array.from(this.playedSongs),
                currentSongSlug: this.currentSongSlug,
                followMode: this.followMode
            };
            localStorage.setItem('rabbitholeState', JSON.stringify(toSave));
            console.log('🐰 State saved to localStorage');
        } catch (e) {
            console.warn('🐰 Could not save state:', e);
        }
    }

    /**
     * Load state from localStorage
     */
    loadFromStorage() {
        try {
            const saved = localStorage.getItem('rabbitholeState');
            if (saved) {
                const parsed = JSON.parse(saved);
                this.playedSongs = new Set(parsed.playedSongs || []);
                this.followMode = parsed.followMode || 'same';
                console.log('🐰 State loaded from localStorage:', parsed.playedSongs?.length || 0, 'played songs');
                return parsed;
            }
        } catch (e) {
            console.warn('🐰 Could not load state:', e);
        }
        return null;
    }

    /**
     * Clear all state
     */
    clear() {
        localStorage.removeItem('rabbitholeState');
        this.playedSongs.clear();
        this.followingMusician = null;
        this.currentSongSlug = null;
        this.history = [];
        this.nextSong = null;
        this.queue = [];
        console.log('🐰 State cleared');
        this.onStateChange();
    }

    /**
     * Set the musician to follow
     */
    setFollowingMusician(musicianName) {
        const previousMusician = this.followingMusician;
        this.followingMusician = musicianName;

        console.log(`🐰 Rabbit now following: ${musicianName}`);
        this.saveToStorage();
        this.onStateChange({ previousMusician, newMusician: musicianName });

        // Queue next song by this musician
        this.queueNextSongByMusician(musicianName);
    }

    /**
     * Find and queue the next song featuring a musician
     */
    async queueNextSongByMusician(musicianName) {
        const connectionsData = await this.getConnections(musicianName);
        if (!connectionsData) return;

        const catalog = this.getCatalog();

        // Filter to songs with rabbithole data that we haven't played
        const playableSongs = connectionsData.filter(conn => {
            const songSlug = this.normalizeSlug(conn.song);
            const hasRabbithole = catalog[songSlug];
            const notPlayed = !this.playedSongs.has(songSlug);
            const notCurrent = songSlug !== this.currentSongSlug;
            return hasRabbithole && notPlayed && notCurrent;
        });

        if (playableSongs.length === 0) {
            console.log(`🐰 No unplayed songs available for ${musicianName} in catalog`);
            this.nextSong = { songSlug: null, songTitle: 'No songs queued', viaMusician: musicianName };
            this.onNextSongQueued(this.nextSong);
            return;
        }

        // Pick a random song from available ones
        const randomIndex = Math.floor(Math.random() * playableSongs.length);
        const nextSong = playableSongs[randomIndex];
        const nextSlug = this.normalizeSlug(nextSong.song);

        // Get the actual title from catalog
        const catalogEntry = catalog[nextSlug];
        const songTitle = catalogEntry ? catalogEntry.title : nextSong.song;

        // Clear queue and add this song
        this.queue = [nextSlug];
        this.nextSong = { songSlug: nextSlug, songTitle, viaMusician: musicianName };

        console.log(`🐰 Next up: "${songTitle}" via ${musicianName}`);
        this.onNextSongQueued(this.nextSong);
    }

    /**
     * Normalize a song title to a slug
     */
    normalizeSlug(title) {
        return title.toLowerCase().replace(/\s+/g, '-').replace(/'/g, '');
    }

    /**
     * Set the current song
     */
    setCurrentSong(songSlug) {
        // Add previous song to history if we had one
        if (this.currentSongSlug && this.nextSong) {
            const catalog = this.getCatalog();
            const currentSongData = catalog[this.currentSongSlug];
            if (currentSongData) {
                this.history.push({
                    songSlug: this.currentSongSlug,
                    songTitle: currentSongData.title,
                    viaMusician: this.nextSong.viaMusician
                });
            }
        }

        // Mark previous song as played
        if (this.currentSongSlug) {
            this.playedSongs.add(this.currentSongSlug);
        }

        this.currentSongSlug = songSlug;
        this.saveToStorage();
        this.onStateChange();
    }

    /**
     * Get the next song from queue
     */
    popNextSong() {
        if (this.queue.length === 0) {
            return null;
        }
        return this.queue.shift();
    }

    /**
     * Add a song to the queue
     */
    addToQueue(songSlug) {
        this.queue.push(songSlug);
        console.log(`🐰 Added ${songSlug} to queue. Queue length: ${this.queue.length}`);
    }

    /**
     * Get the previous song from history
     */
    getPreviousSong() {
        if (this.history.length === 0) {
            return null;
        }
        return this.history[this.history.length - 1];
    }

    /**
     * Go back to previous song
     */
    goBack() {
        if (this.history.length === 0) {
            return null;
        }

        const previousSong = this.history.pop();

        // Remove from played songs
        this.playedSongs.delete(previousSong.songSlug);

        return previousSong;
    }

    /**
     * Check if a song is playable (in catalog and not played)
     */
    isPlayable(songSlug) {
        const catalog = this.getCatalog();
        return catalog[songSlug] && !this.playedSongs.has(songSlug) && songSlug !== this.currentSongSlug;
    }

    /**
     * Get current state for UI
     */
    getState() {
        return {
            followingMusician: this.followingMusician,
            currentSongSlug: this.currentSongSlug,
            nextSong: this.nextSong,
            history: this.history,
            queueLength: this.queue.length,
            playedCount: this.playedSongs.size
        };
    }
}

export default RabbitholeState;
