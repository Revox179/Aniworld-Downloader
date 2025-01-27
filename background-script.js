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
        getVideoLink(msg.url).then(link => {
            if (!link) { sendResponse({ result: false }); return; }
            console.log("Video link: " + link);
            // get video source (download link)
            getVideoSource(link).then(source => {
                if (!source) { sendResponse({ result: false }); return; }
                console.log("Video source: " + source);
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

async function getSeasonLinks(anime) {
    const doc = await fetchAndParse(anime);
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

async function getEpisodeLinks(season) {
    const doc = await fetchAndParse(season);
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

async function getVideoLink(episode) {
    const doc = await fetchAndParse(episode);
    if (!doc) { return false; }
    const vlink = doc.querySelector('[title="Hoster Vidoza"]').parentElement.getAttribute("href");
    return `https://aniworld.to${vlink}`;
}


/********************************************************************************
 * Following functions are used to handle the download requests from the
 * popup script and start the download process.
 ********************************************************************************/

async function getVideoSource(url) {
    try {
        const doc = await fetchAndParse(url);
        if (!doc) { return false; }
        const video = doc.querySelector("#player source");
        return video.getAttribute("src");

    } catch (error) {
        console.error(`An error occured while fetching video source: ${error}\nURL: ${url}`);
        return false;
    }


}

function sanitizeFilename(filename) {
    return filename.replace(/[^a-zA-Z0-9] /g, '') || "video";
}

function downloadStarted(id) {
    console.log('Download started: ' + id);
}

function downloadFailed(error) {
    console.log('Download failed: ' + error);
}
