function createDownloadPage(url) {
    browser.runtime.sendMessage({cmd: "getAnimeInfo", anime: url})
    .then(async (response) => {
        if (response === undefined || response.result === undefined) {
            console.error(`No response from content script: \nRequest: getAnimeInfo\nURL: ${url}`);
            return;
        }

        // check response
        if (response.result === false) {
            console.error(`An internal API error occured -> response.result was false: \n\
            Request: getAnimeInfo\nURL: ${url}\nError: ${"Empty response"}`);
            // toggle no results msg
            startSearchmode();
            document.getElementById("no_search").classList.add("hidden");
            document.getElementById("no_results").classList.remove("hidden");
            return;
        } else if (response.result.title === undefined || response.result.title === "") {
            console.error(`An internal API error occured -> result.title is empty: \n\
            Request: getAnimeInfo\nURL: ${url}\nError: ${"No title found"}`);
            return;
        } else if (response.result.cover === "https://aniworld.to") {
            console.error(`An internal API error occured -> result.cover is invalid: \n\
            Request: getAnimeInfo\nURL: ${url}\nError: ${"No cover found"}`);
            return;
        }

        console.log(response.result);

        let anime_title = document.getElementById("anime_title");
        let anime_cover = document.getElementById("cover_img");
        let season_counts = document.getElementById("season_count");
        let film_counts = document.getElementById("film_count");

        // update anime title
        anime_title.innerText = response.result.title;
        anime_title.classList.remove("skeleton")

        // update anime cover image
        if (anime_cover === null) {
            anime_cover = document.createElement("img");
            anime_cover.id = "cover_img";
            anime_cover.src = response.result.cover;
            document.getElementById("cover_holder").appendChild(anime_cover);
        } else { anime_cover.src = response.result.cover; }
        document.getElementById("cover_holder").classList.remove("skeleton");

        // update season count
        season_counts.innerText = Object.keys(response.result.seasonLinks.seasons).length;
        season_counts.classList.remove("skeleton");
        season_counts.parentElement.classList.remove("skeleton");

        // update film count
        film_counts.innerText = Object.keys(response.result.seasonLinks.films).length;
        film_counts.classList.remove("skeleton");
        film_counts.parentElement.classList.remove("skeleton");

        // update season list
        const season_list = document.getElementById("season_list");
        const demo_season = document.getElementById("demo_season");
        for (let season in response.result.seasonLinks.seasons) {
            let season_link = response.result.seasonLinks.seasons[season];
            // get episode links
            const resp = await browser.runtime.sendMessage({cmd: "getEpisodeLinks", season: season_link});
            if (resp === undefined || resp.result === undefined) {
                console.error(`No response from content script: \n\
                Request: getEpisodeLinks\nURL: ${season_link}`);
                return;
            }
            if (resp.result === false) {
                console.error(`An internal API error occured -> response.result was false: \n\
                Request: getEpisodeLinks\nURL: ${season_link}\nError: ${"Empty response"}`);
                return;
            }
            let season_div = document.createElement("div");
            season_div.classList.add("season");
            season_div.innerHTML = `
            <span class="head">
                <h2 class="season-title">Season ${season}</h2>
                <a class="download-all">
                    <img src="images/download.svg">
                </a>
            </span>`;
            const season_episodes = document.createElement("div");
            season_episodes.classList.add("episodes");
            for (let episode in resp.result) {
                let entry = document.createElement("span");
                entry.classList.add("episode");
                entry.innerHTML = `
                <h3 class="episode-title">${resp.result[episode].name}</h3>
                <a class="download" data-url="${resp.result[episode].link}" data-season="${season}" data-episode="${episode}">
                    <img src="images/download.svg">
                </a>`;
                season_episodes.appendChild(entry);
            }
            season_div.appendChild(season_episodes);
            season_list.appendChild(season_div);
            if (demo_season !== null) {
                demo_season.classList.add("hidden");
            }
        }

        // update film list
        const film_list = document.getElementById("film_list");
        const demo_film = document.getElementById("demo_film");

        if (Object.keys(response.result.seasonLinks.films).length === 0) {
            film_list.classList.add("hidden");
        } else {
            const film_div = document.createElement("div");
            film_div.classList.add("film");
            film_div.innerHTML = `
            <span class="head">
                <h2 class="film-title">Filme</h2>
                <a class="download-all">
                    <img src="images/download.svg">
                </a>
            </span>`;

            const episode_div = document.createElement("div");
            episode_div.classList.add("episodes");

            for (let key in response.result.seasonLinks.films) {
                if (key === false) {
                    console.error(`An internal API error occured -> result.seasonLinks.films is empty: \n\
                    Request: getAnimeInfo\nURL: ${url}\nError: ${"No film found"}`);
                    return;
                }
                let film = response.result.seasonLinks.films[key];
                let entry = document.createElement("span");
                entry.classList.add("episode");
                entry.innerHTML = `
                <h3 class="episode-title">${film.name}</h3>
                <a class="download" data-url="${film.link}">
                    <img src="images/download.svg">
                </a>`;
                episode_div.appendChild(entry);
            }

            film_div.appendChild(episode_div);
            film_list.appendChild(film_div);
        }

        if (demo_film !== null) {
            demo_film.classList.add("hidden");
        }

        // add toggle season/film fold event
        document.querySelectorAll(".head").forEach(head => {
            head.addEventListener("click", () => {
                head.nextElementSibling.classList.toggle("fold");
            });
        });
    })
    .then( () => {
        addDownloadListener();
    })
    .catch(error => {
        console.error(`An error occurred while sending message to content script: \n\
        Request: getAnimeInfo\nError: ${error}`);
    });
}

function searchQuery(query) {
    browser.runtime.sendMessage({cmd: "querySearch", query: query}).then(async (response) => {
        if (response === undefined || response.result === undefined) {
            console.error(`No response from content script: \n\
            Request: querySearch\nQuery: ${query}`);
            return;
        }

        // hide demos
        document.querySelectorAll(".search-list .item.demo").forEach(item => {
            item.classList.add("hidden");
        })

        // if reponse is false -> no results found
        if (response.result === false) {
            document.getElementById("no_results").classList.remove("hidden");
            return;
        }

        function cutDescription(des) {
            // if larger then 120 chars -> cut and add three dots to the end
            if (des.length > 100) {
                des = des.slice(0, 101);
                des += "...";
            }
            // remove whitespace chars
            des.replaceAll("\n", "");
            return des;
        }

        // add the actual search results
        response.result.forEach(result => {
            let item = document.createElement("div");
            item.classList.add("item");
            item.innerHTML = `
            <div class="item-title">${result.title}</div>
            <div class="item-description">${cutDescription(result.description)}</div>`
            item.addEventListener("click", () => {
                startSearchmode("stream");
                createDownloadPage("https://aniworld.to" + result.link);
                addDownloadListener();
            })
            document.getElementById("search_results").appendChild(item);
        })
    }).catch(error => {
        console.error(`An error occurred while sending message to background script: \n\
        Request: querySearch\nError: ${error}`);
    })
}

function clearDownloadPage() {
    document.getElementById("anime_title").classList.add("skeleton");
    document.getElementById("cover_holder").classList.add("skeleton");
    if (document.getElementById("cover_img") !== null) {
        document.getElementById("cover_img").remove();
    }
    document.getElementById("season_count").parentElement.classList.add("skeleton");
    document.getElementById("film_count").parentElement.classList.add("skeleton");

    document.querySelectorAll(".season").forEach(season => {
        if (!season.classList.contains("demo")) {
            season.remove();
        } else {
            season.classList.remove("hidden");
        }
    });

    document.querySelectorAll(".film").forEach(film => {
        if (film.classList.contains("demo") === false) {
            film.remove();
        } else {
            film.classList.remove("hidden");
        }
    });
}

function clearSearchResults() {
    document.querySelectorAll(".search-list .item").forEach(child => {
        if (!child.classList.contains("demo")) {
            child.remove();
        } else {
            child.classList.remove("hidden");
        }
    });
    document.getElementById("search_results").classList.remove("hidden");
}

function startSearchmode(mode = null) {
    if (mode === "search") {
        document.getElementById("no_search").classList.add("hidden");
        document.getElementById("no_results").classList.add("hidden");
        document.getElementById("anime_infobox").classList.add("hidden");
        document.getElementById("season_list").classList.add("hidden");
        document.getElementById("film_list").classList.add("hidden");
        document.getElementById("search_results").classList.remove("hidden");
        clearSearchResults();
    } else if (mode === "stream") {
        document.getElementById("no_search").classList.add("hidden");
        document.getElementById("no_results").classList.add("hidden");
        document.getElementById("search_results").classList.add("hidden");
        document.getElementById("anime_infobox").classList.remove("hidden");
        document.getElementById("season_list").classList.remove("hidden");
        document.getElementById("film_list").classList.remove("hidden");
        clearDownloadPage();
    } else {
        document.getElementById("no_results").classList.add("hidden");
        document.getElementById("search_results").classList.add("hidden");
        document.getElementById("anime_infobox").classList.add("hidden");
        document.getElementById("season_list").classList.add("hidden");
        document.getElementById("film_list").classList.add("hidden");
        document.getElementById("no_search").classList.remove("hidden");
    }
}

function handleSearch(value) {
    // check if input is stream url or query search
    if (value && value.startsWith("https://aniworld.to/anime/stream/")) {
        // actually a direct stream url -> prepare download page
        startSearchmode("stream");
        createDownloadPage(value);
        addDownloadListener();
        return;
    } else if (value) {
        // search query -> prepare search results
        startSearchmode(mode = "search");
        searchQuery(value);
    } else {
        // no input -> return to home screen
        startSearchmode();
    }
}

document.getElementById("url_search").addEventListener("keydown", (e) => {
    if (e.key === "Enter") { handleSearch(e.target.value); }
});

document.getElementById("search").addEventListener("click", () => {
    let url = document.getElementById("url_search").value;
    handleSearch(url);
});

function addDownloadListener() {
    document.querySelectorAll("a.download").forEach(link => {
        link.addEventListener("click", () => {
            // TODO: add some feedback, download is clicked

            const anime_title = document.getElementById("anime_title").innerText;
            const identifier = `s${link.getAttribute("data-season")}ep${link.getAttribute("data-episode")}`;
            const episode_title = link.previousElementSibling.innerText;

            browser.runtime.sendMessage({
                cmd: "download",
                url: link.getAttribute("data-url"),
                filename: `${anime_title}_${identifier}_${episode_title}.mp4`
            })
            .then(response => {
                if (response === undefined || response.result === undefined) {
                    console.error(`No response from background script: \n\
                    Request: download\nURL: ${link.getAttribute("data-url")}`);
                    return;
                }
                if (response.result === false) {
                    console.error(`An internal API error occured -> response.result was false: \n\
                    Request: download\nURL: ${link.getAttribute("data-url")}\nError: ${"Empty response"}`);
                    return;
                }
                console.log("Download started!");
            }).catch(error => {
                console.error(`An error occurred while sending message to background script: \n\
                Request: download\nError: ${error}`);
            });
        });
    });
}