/**
 * This script runs in the background and is responsible for handling the
 * api requests and downloads of the animes.
 */

// message listener to handle the requests from the popup script
browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    console.log('Message received with command: ' + msg.cmd + "\n\n");

    if (msg.cmd === "getAnimeInfo") {
        getAnimeInfo(msg.anime).then(info => {
            sendResponse({ result: info });
        });
    }
    if (msg.cmd === "getEpisodeLinks") {
        getEpisodeLinks(msg.season).then(links => {
            sendResponse({ result: links });
        });
    }
    if (msg.cmd === "querySearch") {
        searchQuery(msg.query).then(results => {
            sendResponse({ result: results });
        });
    }
    if (msg.cmd === "download") {
        // query downlaod link
        getStreamLink(msg.url).then(link => {
            if (!link) { sendResponse({ result: false }); return; }
            getVideoSource(link).then(source => {
                if (!source) { sendResponse({ result: false }); return; }
                console.log("Downloading video from: " + source);
                // start download
                browser.downloads.download({
                    url: source,
                    filename: sanitizeFilename(msg.filename),
                    conflictAction: "uniquify"
                }).then(downloadStarted, downloadFailed);
                sendResponse({ result: true });
            }).catch(error => {
                console.error(`An error occured while getting video source: ${error}`);
                sendResponse({ result: false });
            });

        });
    }
    return true;
});


/********************************************************************************
 * Following functions belong to the api and used to fetch necessary
 * information about the animes like title, cover, seasons, films and
 * episode links and corresponding video links for downloading.
 ********************************************************************************/


async function fetchAndParse(url) {
    try {
        const response = await fetch(url);
        const data = await response.text();
        const parser = new DOMParser();
        return parser.parseFromString(data, "text/html");
    } catch (error) {
        console.error(`An error occurred while fetching and parsing: \nURL: ${url}\nError: ${error}`);
        return false;
    }
}

async function searchQuery(query) {
    // make query to valid query string
    query = encodeURIComponent(query);

    let resp;
    try {
        resp = await fetch("https://aniworld.to/ajax/search", {
            "headers": {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            },
            "referrer": "https://aniworld.to/search?q=" + query,
            "body": "keyword=" + query,
            "method": "POST",
        })
    } catch (error) {
        console.error(`An error occured when fetching to https://aniworld.to/ajax/search\nFunction: searchQuery -> ${query}\nError: ${error}`)
        return false;
    }

    if (!resp.ok) {
        console.error(`Network response was not ok: ${resp.status}\nFunction: searchQuery -> ${query}`);
        return false;
    }

    try {
        let data = await resp.json();
        data = data.filter(result => result.link.startsWith("/anime/stream"));
        return data;
    } catch (error) {
        console.error(`Response from search query is not valid: ${error}\nFunction: searchQuery -> ${query}`);
        return false;
    }
}

/**
 * Fetches and parses information about an anime, including its title, cover image, and season links.
 *
 * @param {string} anime - The URL or identifier of the anime to fetch information for.
 * @returns {Promise<Object|boolean>} A promise that resolves to an object containing the anime's title, cover image URL,
 *                                    and season links, or `false` if an error occurs or data is unavailable.
 * @property {string} return.title - The title of the anime.
 * @property {string} return.cover - The full URL of the anime's cover image.
 * @property {Object} return.seasonLinks - An object containing season and film links categorized as "seasons" and "films".
 * @throws {Error} Logs an error message to the console if an exception occurs during processing.
 */
async function getAnimeInfo(anime) {
    const doc = await fetchAndParse(anime);
    if (!doc) { return false; }
    try {
        const title = doc.querySelector(".series-title span").innerText;
        const cover = doc.querySelector(".seriesCoverBox img").getAttribute("data-src");
        const seasonLinks = await getSeasonLinks(anime);
        if (!seasonLinks) { return false; }
        if (Object.keys(seasonLinks["films"]).length > 0) {
            seasonLinks["films"] = await getEpisodeLinks(Object.values(seasonLinks["films"])[0]);
        }
        return { "title": title, "cover": `https://aniworld.to${cover}`, "seasonLinks": seasonLinks };
    } catch (error) {
        console.error(`An error occured while getting anime info: ${error}\nFunction: getAnimeInfo -> ${anime}`);
        return false;
    }
}

/**
 * Fetches and parses the season and film links for a given anime page.
 *
 * @param {string} anime_link - The URL of the anime page to fetch and parse.
 * @returns {Promise<Object|boolean>} An object containing season and film links categorized as "seasons" and "films",
 *                                    or `false` if the document could not be fetched or parsed.
 * @property {Object} return.films - An object containing film links, where keys are film names and values are URLs.
 * @property {Object} return.seasons - An object containing season links, where keys are season names and values are URLs.
 * @throws {Error} Logs an error message to the console if an exception occurs during processing.
 */
async function getSeasonLinks(anime_link) {
    const doc = await fetchAndParse(anime_link);
    if (!doc) { return false; }
    const seasons = doc.querySelector("#stream ul").querySelectorAll("a");
    const seasonLinks = { "films": {}, "seasons": {} };
    seasons.forEach(season => {
        let href = `https://aniworld.to${season.getAttribute("href")}`;

        href.endsWith("/filme") ?
            seasonLinks["films"][season.innerText] = href :
            seasonLinks["seasons"][season.innerText] = href;
    });
    return seasonLinks;
}

/**
 * Fetches and parses the episode links for a given season.
 *
 * @param {string} season_link - The URL or identifier of the season to fetch episode links for.
 * @returns {Promise<Object|boolean>} A promise that resolves to an object containing episode details,
 *                                    or `false` if the document could not be fetched or parsed.
 *                                    The object keys are episode numbers, and the values are objects with the following properties:
 *                                    - `name` {string}: The name of the episode.
 *                                    - `link` {string}: The full URL to the episode.
 *                                    - `langs` {string[]}: An array of language codes available for the episode.
 */
async function getEpisodeLinks(season_link) {
    const doc = await fetchAndParse(season_link);
    if (!doc) { return false; }
    const episodes = doc.querySelectorAll(".seasonEpisodeTitle a");
    const episodeLinks = {};
    episodes.forEach(episode => {
        const episode_container = episode.parentElement.parentElement;
        const episode_number = episode_container.getAttribute("data-episode-season-id");
        const episode_name = episode.innerText;
        const episode_link = `https://aniworld.to${episode.getAttribute("href")}`;
        const episode_langs = Array.from(episode_container.querySelectorAll("img.flag")).map(img => img.src.split("/").pop());
        episodeLinks[episode_number] = {
            "name": episode_name,
            "link": episode_link,
            "langs": episode_langs
        };
    });
    return episodeLinks;
}

/**
 * Fetches and parses the streaming link for a given episode. This just the refered link from aniworld. The actual
 * video link to the mp4 file can be get from the page behind this link (see getVideoSource function).
 *
 * @param {string} episode_link - The URL of the episode page to fetch.
 * @returns {Promise<string|boolean>} A promise that resolves to the streaming link for the episode,
 *                                    or `false` if the document could not be fetched or parsed.
 * @throws {Error} Logs an error message to the console if an exception occurs during processing.
 */
async function getStreamLink(episode_link) {
    const doc = await fetchAndParse(episode_link);
    if (!doc) { return false; }
    const vlink = doc.querySelector('[title="Hoster VOE"]').parentElement.getAttribute("href");

    const referrerPage = await fetchAndParse(`https://aniworld.to/${vlink}`);
    if (!referrerPage) { return false; }

    for (let script of referrerPage.scripts) {
        const scriptContent = script.textContent;

        // search for actual redirect link
        if (scriptContent.includes("window.location.href")) {
            const match = scriptContent.match(/window\.location\.href\s*=\s*['"]([^'"]+)['"]/);
            if (match && match[1]) {
                console.log("Found redirect link: " + match[1]);
                return match[1];
            }
        }
    }

    return false;
}

/**
 * Fetches and parses the video source for a given streaming link. This is the actual mp4 video file.
 *
 * @param {string} url - The URL of the streaming page to fetch.
 * @returns {Promise<string|boolean>} A promise that resolves to the video source URL,
 *                                    or `false` if the document could not be fetched or parsed.
 * @throws {Error} Logs an error message to the console if an exception occurs during processing.
 */
async function getVideoSource(url) {

    function rot13transform(source) {
        // See: https://en.wikipedia.org/wiki/ROT13
        let result = '';
        for (let char of source) {
            let charCode = char.charCodeAt(0);
            if (charCode >= 0x41 && charCode <= 0x5a) {
                charCode = (charCode - 0x41 + 0xd) % 0x1a + 0x41;
            } else if (charCode >= 0x61 && charCode <= 0x7a) {
                charCode = (charCode - 0x61 + 0xd) % 0x1a + 0x61;
            }
            result += String.fromCharCode(charCode);
        }
        return result;
    }

    function regex_replace(source) {
        const patterns = ["@$", "^^", "~@", "%?", "*~", "!!", "#&"];
        patterns.forEach(pattern => {
            const regexPattern = new RegExp(pattern.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g');
            source = source.replace(regexPattern, "");
        });
        return source;
    }

    function left_shift(source, shift) {
        let result = [];
        for (let char of source) {
            result.push(String.fromCharCode(char.charCodeAt(0) - shift));
        }
        return result.join('');
    }

    function getHighestResFallbackFile(fallback) {
        if (!Array.isArray(fallback) || fallback.length === 0) {
            console.error("Invalid or empty fallback array.");
            return null;
        }

        // Sort the array by the 'label' property (resolution) in descending order
        const sortedFallback = fallback.sort((a, b) => b.label.localeCompare(a.label));

        // Return the 'file' property of the highest resolution entry (contains the video download URL)
        return sortedFallback[0]?.file || null;
    }

    try {
        const doc = await fetchAndParse(url);
        if (!doc) { return false; }

        for (let script of doc.scripts) {
            const scriptContent = script.textContent;

            // search for the `MKGMa` string and deobfuscate it
            if (!scriptContent.includes('MKGMa="')) continue;
            const obfuscated_string = scriptContent.split('MKGMa="')[1].split('"')[0]
            const deobfuscated_string = regex_replace(rot13transform(obfuscated_string));
            const decoded_string = atob(left_shift(atob(deobfuscated_string), 3).split("").reverse().join(""));

            json_data = JSON.parse(decoded_string);

            fallback_file = getHighestResFallbackFile(json_data["fallback"]);
            if (fallback_file) {
                console.log("Fallback file: " + fallback_file);
                return fallback_file;
            }

            console.log("No fallback file found, try using direct access URL.");

            direct_access_url = json_data["direct_access_url"];
            if (direct_access_url) {
                console.log("Direct access URL: " + direct_access_url);
                return direct_access_url;
            }
            console.error("No direct access URL found. Can not download video.");
            return false;
        }
        return false;
    } catch (error) {
        console.error(`An error occured while fetching video source: ${error}\nURL: ${url}`);
        return false;
    }
}

/********************************************************************************
 * Following functions are used to handle the download requests from the
 * popup script and start the download process.
 ********************************************************************************/


function sanitizeFilename(filename) {
    return filename.replace(/[^a-zA-Z0-9 ]/g, '').trim() || "video";
}

async function downloadStarted(id) {
    const [downloadItem] = await browser.downloads.search({ id });

    if (!downloadItem) {
        console.error(`Download item with id ${id} not found after start event.`);
        return;
    }

    const { filename: fullPath, startTime: start, url } = downloadItem;
    const filename = fullPath.split("/").pop();
    await browser.storage.local.set(
        { [id.toString()]: { filename, start, state: "in_progress", url } }
    )
    console.log(`Download started: ${filename}`);
}

function downloadFailed(error) {
    console.log('Download failed: ' + error);
}
