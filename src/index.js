/**
 * Rabbithole
 * "discover music by connections, not algorithms"
 *
 * A music player that lets you follow musicians through their discographies.
 */

export { RabbitholeState } from './state.js';
export { CatalogAPI, StaticCatalog, PickiPediaCatalog } from './catalog.js';
export { default as WebampChartifacts } from './player/webamp-chartifacts.js';

import { RabbitholeState } from './state.js';
import { StaticCatalog, PickiPediaCatalog } from './catalog.js';

/**
 * Main Rabbithole Player class
 * Coordinates the visualization player, state, and catalog
 */
export class RabbitholePlayer {
    constructor(options = {}) {
        this.containerId = options.containerId || 'rabbithole-player';
        this.catalog = options.catalog || new StaticCatalog({});

        // Initialize state with catalog access
        this.state = new RabbitholeState({
            getCatalog: () => this.catalogData,
            getConnections: (musician) => this.catalog.getMusicianConnections(musician),
            onStateChange: () => this.handleStateChange(),
            onNextSongQueued: (nextSong) => this.handleNextSongQueued(nextSong)
        });

        this.catalogData = {};
        this.player = null;  // WebampChartifacts instance
        this.currentTrack = null;

        // UI callbacks
        this.onSongChange = options.onSongChange || (() => {});
        this.onMusicianClick = options.onMusicianClick || (() => {});
        this.onNextUp = options.onNextUp || (() => {});
    }

    /**
     * Initialize the player
     */
    async init() {
        // Load catalog
        this.catalogData = await this.catalog.getCatalog();
        console.log('🐰 Loaded catalog:', Object.keys(this.catalogData).length, 'songs');

        return this;
    }

    /**
     * Load and play a song
     */
    async playSong(slug) {
        const track = await this.catalog.getSong(slug);
        if (!track) {
            console.error('Song not found:', slug);
            return;
        }

        this.currentTrack = track;
        this.state.setCurrentSong(slug);

        // Initialize or update player
        if (this.player) {
            this.player.loadNewSong(track);
        } else {
            // Dynamically import to avoid bundling Webamp if not needed
            const { default: WebampChartifacts } = await import('./player/webamp-chartifacts.js');
            this.player = new WebampChartifacts(this.containerId, track, {
                embedMode: false
            });
        }

        this.onSongChange(track);
        this.setupMusicianClickHandlers();
    }

    /**
     * Play the next song in the rabbithole
     */
    async playNext() {
        const nextSlug = this.state.popNextSong();

        if (!nextSlug) {
            // No songs in queue - try to find one from a bandmate
            const bandmates = this.getBandmates();
            if (bandmates.length > 0) {
                const randomBandmate = bandmates[Math.floor(Math.random() * bandmates.length)];
                console.log(`🐰 Switching to bandmate: ${randomBandmate}`);
                this.state.setFollowingMusician(randomBandmate);

                const newNextSlug = this.state.popNextSong();
                if (newNextSlug) {
                    await this.playSong(newNextSlug);
                    return;
                }
            }

            console.log('🐰 End of rabbithole - no more songs');
            return;
        }

        await this.playSong(nextSlug);

        // Re-queue next song by current musician
        if (this.state.followingMusician) {
            await this.state.queueNextSongByMusician(this.state.followingMusician);
        }
    }

    /**
     * Go back to previous song
     */
    async playPrevious() {
        const previousSong = this.state.goBack();
        if (previousSong) {
            await this.playSong(previousSong.songSlug);
        }
    }

    /**
     * Get bandmates from current ensemble (excluding followed musician)
     */
    getBandmates() {
        if (!this.currentTrack || !this.currentTrack.ensemble) {
            return [];
        }

        return Object.keys(this.currentTrack.ensemble)
            .filter(name => name !== this.state.followingMusician);
    }

    /**
     * Follow a specific musician
     */
    followMusician(musicianName) {
        this.state.setFollowingMusician(musicianName);
        this.updateRabbitIcon();
    }

    /**
     * Set up click handlers for musician names
     */
    setupMusicianClickHandlers() {
        setTimeout(() => {
            const musicianNames = document.querySelectorAll('.musician-name');
            musicianNames.forEach(el => {
                if (el.dataset.rabbitholeAttached) return;
                el.dataset.rabbitholeAttached = 'true';

                el.style.cursor = 'pointer';
                el.addEventListener('click', (e) => {
                    const name = this.extractMusicianName(el.textContent);

                    if (e.shiftKey) {
                        this.followMusician(name);
                    } else {
                        this.onMusicianClick(name, e);
                    }
                });
            });
        }, 500);
    }

    /**
     * Extract musician name from display text
     */
    extractMusicianName(text) {
        return text
            .replace(/\s*🐰\s*$/, '')
            .replace(/\s*\([^)]*\)$/, '')
            .trim();
    }

    /**
     * Handle state changes
     */
    handleStateChange() {
        this.updateRabbitIcon();
    }

    /**
     * Handle next song being queued
     */
    handleNextSongQueued(nextSong) {
        this.onNextUp(nextSong);
    }

    /**
     * Update rabbit icon position in UI
     */
    updateRabbitIcon() {
        document.querySelectorAll('.rabbithole-icon').forEach(el => el.remove());

        if (this.state.followingMusician) {
            const musicianId = `musician-${this.state.followingMusician.replace(/\s+/g, '-').toLowerCase()}`;
            const musicianDiv = document.getElementById(musicianId);

            if (musicianDiv) {
                const nameEl = musicianDiv.querySelector('.musician-name');
                if (nameEl && !nameEl.querySelector('.rabbithole-icon')) {
                    const rabbitIcon = document.createElement('span');
                    rabbitIcon.className = 'rabbithole-icon';
                    rabbitIcon.textContent = ' 🐰';
                    rabbitIcon.title = `Following ${this.state.followingMusician}'s rabbithole`;
                    nameEl.appendChild(rabbitIcon);
                }
            }
        }
    }

    /**
     * Get current state for UI
     */
    getState() {
        return this.state.getState();
    }

    /**
     * Destroy the player
     */
    destroy() {
        if (this.player && this.player.cleanup) {
            this.player.cleanup();
        }
        this.player = null;
    }
}

// Make globally available for script tag usage
if (typeof window !== 'undefined') {
    window.RabbitholePlayer = RabbitholePlayer;
    window.RabbitholeState = RabbitholeState;
    window.StaticCatalog = StaticCatalog;
    window.PickiPediaCatalog = PickiPediaCatalog;
}

export default RabbitholePlayer;
