/**
 * Rabbithole Catalog API
 *
 * Defines the contract for song/musician data that Rabbithole needs.
 * This can be implemented by:
 * - PickiPedia (via MediaWiki API + Semantic MediaWiki)
 * - Static JSON (for testing/embedding)
 * - Local files (FLAC metadata extraction)
 */

/**
 * Song data structure that Rabbithole expects
 * @typedef {Object} RabbitholeTrack
 * @property {string} title - Song title
 * @property {string} slug - URL-safe identifier
 * @property {string} audioFile - URL to audio file
 * @property {number} duration - Duration in seconds
 * @property {Object<string, string[]>} ensemble - Map of musician name to instruments
 * @property {Object} timeline - Timeline of musical events/sections
 * @property {number} [standardSectionLength] - Default section length in seconds
 * @property {Object} [colorScheme] - Visual color scheme for the player
 * @property {string} [engineer] - Recording engineer
 * @property {string} [studio] - Recording studio
 * @property {string} [recordDate] - Recording date
 * @property {string} [sessionType] - Type of session
 * @property {string} [release] - Album/release name
 */

/**
 * Musician connection data
 * @typedef {Object} MusicianConnection
 * @property {string} song - Song title
 * @property {string} context - Description of the connection
 */

/**
 * Abstract catalog interface
 */
export class CatalogAPI {
    /**
     * Get all available songs
     * @returns {Promise<Object<string, RabbitholeTrack>>} Map of slug to track data
     */
    async getCatalog() {
        throw new Error('getCatalog must be implemented');
    }

    /**
     * Get a specific song by slug
     * @param {string} slug - Song slug
     * @returns {Promise<RabbitholeTrack|null>}
     */
    async getSong(slug) {
        throw new Error('getSong must be implemented');
    }

    /**
     * Get connections for a musician (other songs they appear on)
     * @param {string} musicianName - Musician name
     * @returns {Promise<MusicianConnection[]>}
     */
    async getMusicianConnections(musicianName) {
        throw new Error('getMusicianConnections must be implemented');
    }

    /**
     * Search for songs by title or musician
     * @param {string} query - Search query
     * @returns {Promise<RabbitholeTrack[]>}
     */
    async search(query) {
        throw new Error('search must be implemented');
    }
}

/**
 * Static JSON catalog implementation
 * Useful for testing or embedding with pre-baked data
 */
export class StaticCatalog extends CatalogAPI {
    constructor(catalogData, connectionsData = null) {
        super();
        this.catalog = catalogData || {};
        this.connections = connectionsData || {};
    }

    async getCatalog() {
        return this.catalog;
    }

    async getSong(slug) {
        return this.catalog[slug] || null;
    }

    async getMusicianConnections(musicianName) {
        // Clean up musician name (remove instrument in parentheses)
        const cleanName = musicianName.replace(/\s*\([^)]*\)$/, '').trim();

        // Try exact match first
        if (this.connections[cleanName]) {
            return this.connections[cleanName];
        }

        // Try partial match
        for (const [oracleName, connections] of Object.entries(this.connections)) {
            if (cleanName.includes(oracleName.split(' ')[0]) ||
                oracleName.includes(cleanName.split(' ')[0])) {
                return connections;
            }
        }

        return [];
    }

    async search(query) {
        const lowerQuery = query.toLowerCase();
        return Object.values(this.catalog).filter(track =>
            track.title.toLowerCase().includes(lowerQuery) ||
            Object.keys(track.ensemble || {}).some(name =>
                name.toLowerCase().includes(lowerQuery)
            )
        );
    }
}

/**
 * PickiPedia catalog implementation
 * Fetches data from PickiPedia's MediaWiki API
 */
export class PickiPediaCatalog extends CatalogAPI {
    constructor(options = {}) {
        super();
        this.baseUrl = options.baseUrl || 'https://pickipedia.xyz';
        this.apiPath = options.apiPath || '/api.php';
        this.cache = new Map();
        this.cacheTimeout = options.cacheTimeout || 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Make an API request to PickiPedia
     */
    async apiRequest(params) {
        const url = new URL(this.apiPath, this.baseUrl);
        url.searchParams.set('format', 'json');
        url.searchParams.set('origin', '*'); // CORS

        for (const [key, value] of Object.entries(params)) {
            url.searchParams.set(key, value);
        }

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`PickiPedia API error: ${response.status}`);
        }

        return response.json();
    }

    /**
     * Query Semantic MediaWiki for song data
     */
    async querySMW(query) {
        return this.apiRequest({
            action: 'ask',
            query: query
        });
    }

    async getCatalog() {
        // Check cache
        const cacheKey = 'catalog';
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }

        try {
            // Query for all songs with rabbithole data
            const result = await this.querySMW(
                '[[Category:Songs]][[Has rabbithole data::true]]' +
                '|?Has title|?Has audio file|?Has duration|?Has ensemble|?Has timeline' +
                '|limit=500'
            );

            const catalog = {};
            if (result.query && result.query.results) {
                for (const [pageName, pageData] of Object.entries(result.query.results)) {
                    const slug = this.titleToSlug(pageName);
                    catalog[slug] = this.parseTrackData(pageData);
                }
            }

            // Cache the result
            this.cache.set(cacheKey, { data: catalog, timestamp: Date.now() });
            return catalog;

        } catch (error) {
            console.error('Failed to fetch catalog from PickiPedia:', error);
            return {};
        }
    }

    async getSong(slug) {
        const catalog = await this.getCatalog();
        return catalog[slug] || null;
    }

    async getMusicianConnections(musicianName) {
        const cleanName = musicianName.replace(/\s*\([^)]*\)$/, '').trim();

        // Check cache
        const cacheKey = `connections:${cleanName}`;
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }

        try {
            // Query for songs featuring this musician
            const result = await this.querySMW(
                `[[Category:Songs]][[Has musician::${cleanName}]]` +
                '|?Has title|?Has instruments for musician' +
                '|limit=100'
            );

            const connections = [];
            if (result.query && result.query.results) {
                for (const [pageName, pageData] of Object.entries(result.query.results)) {
                    connections.push({
                        song: pageName,
                        context: this.buildConnectionContext(pageData, cleanName)
                    });
                }
            }

            // Cache the result
            this.cache.set(cacheKey, { data: connections, timestamp: Date.now() });
            return connections;

        } catch (error) {
            console.error('Failed to fetch musician connections:', error);
            return [];
        }
    }

    async search(query) {
        try {
            const result = await this.apiRequest({
                action: 'query',
                list: 'search',
                srsearch: query,
                srnamespace: 0, // Main namespace
                srlimit: 20
            });

            if (result.query && result.query.search) {
                // Get full data for each result
                const songs = [];
                for (const item of result.query.search) {
                    const slug = this.titleToSlug(item.title);
                    const song = await this.getSong(slug);
                    if (song) {
                        songs.push(song);
                    }
                }
                return songs;
            }

            return [];
        } catch (error) {
            console.error('Search failed:', error);
            return [];
        }
    }

    /**
     * Convert a page title to a URL slug
     */
    titleToSlug(title) {
        return title.toLowerCase().replace(/\s+/g, '-').replace(/'/g, '');
    }

    /**
     * Parse SMW result into RabbitholeTrack format
     */
    parseTrackData(pageData) {
        const printouts = pageData.printouts || {};

        return {
            title: printouts['Has title']?.[0] || pageData.fulltext,
            slug: this.titleToSlug(pageData.fulltext),
            audioFile: printouts['Has audio file']?.[0] || '',
            duration: parseInt(printouts['Has duration']?.[0]) || 0,
            ensemble: this.parseEnsemble(printouts['Has ensemble']),
            timeline: this.parseTimeline(printouts['Has timeline']),
            // Add more fields as needed
        };
    }

    /**
     * Parse ensemble data from SMW format
     */
    parseEnsemble(ensembleData) {
        if (!ensembleData) return {};

        // This depends on how ensemble is stored in PickiPedia
        // Could be JSON string, or structured SMW data
        if (typeof ensembleData === 'string') {
            try {
                return JSON.parse(ensembleData);
            } catch {
                return {};
            }
        }

        return ensembleData;
    }

    /**
     * Parse timeline data from SMW format
     */
    parseTimeline(timelineData) {
        if (!timelineData) return {};

        if (typeof timelineData === 'string') {
            try {
                return JSON.parse(timelineData);
            } catch {
                return {};
            }
        }

        return timelineData;
    }

    /**
     * Build a context string for a musician connection
     */
    buildConnectionContext(pageData, musicianName) {
        const printouts = pageData.printouts || {};
        const instruments = printouts['Has instruments for musician'] || [];

        if (instruments.length > 0) {
            return `${musicianName} on ${instruments.join(', ')}`;
        }

        return `Featuring ${musicianName}`;
    }
}

export default { CatalogAPI, StaticCatalog, PickiPediaCatalog };
