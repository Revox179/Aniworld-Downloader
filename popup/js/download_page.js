var downloadItemIDs = new Array();

// Handle download state changes (in_progress, complete, paused)
browser.downloads.onChanged.addListener(downloadDelta => {
    if (downloadDelta.state) {
        let downloadItemID = downloadDelta.id;
        let downloadItemState = downloadDelta.state.current;

        if (downloadItemState === "interrupted") {
            downloadItemState = (downloadDelta?.paused?.current) ? "paused" : "interrupted";
        }

        let downloadItem = document.querySelector(`.download-item[data-id="${downloadItemID}"]`);
        downloadItem.setAttribute("data-state", downloadItemState);

        browser.storage.local.get(downloadItemID.toString()).then(result => {
            let downloadItemData = result[downloadItemID.toString()];
            downloadItemData.state = downloadItemState;
            browser.storage.local.set({ [downloadItemID.toString()]: downloadItemData });
        });

        if (downloadItemState === "in_progress") {
            downloadItem.querySelector(".download-item-progress-bar").classList.remove("skeleton");
        }
    }
});

// Handle storage changes (new downloads)
browser.storage.local.onChanged.addListener(changes => {
    for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
        if (!isNaN(key)) {

            // If old value is null, then it is a new download
            // -> Add a new download item to the list
            if (oldValue === null || oldValue === undefined) {
                console.log("Adding new download item to the list");
                newValue.id = parseInt(key);
                addDownloadItem(newValue);
            }
        }
    }
});

// Get all downloads from storage when popup is opened
browser.storage.local.get().then(result => {
    console.log(result);

    if (Object.keys(result).length === 0) {
        document.getElementById("no_downloads").classList.remove("hidden");
    } else {
        for (let [key, value] of Object.entries(result)) {
            value.id = parseInt(key);
            addDownloadItem(value);
        }
    }
});

// Periodically update download progress
setInterval(() => {
    downloadItemIDs.forEach(downloadItemID => {
        browser.downloads.search({ id: downloadItemID }).then(downloadItems => {
            let downloadItem = downloadItems[0];

            if (!downloadItem) {
                console.log(`Download Item with ID ${downloadItemID} seems to be removed`);
                browser.storage.local.remove(downloadItemID.toString());
                downloadItemIDs.splice(downloadItemIDs.indexOf(downloadItemID), 1);
                let downloadItemElement = document.querySelector(`.download-item[data-id="${downloadItemID}"]`);
                if (downloadItemElement) { downloadItemElement.remove(); }
                return
            }

            switch (downloadItem.state) {
                case "in_progress":
                    let downloadItemProgress = downloadItem.bytesReceived / downloadItem.totalBytes * 100;
                    updateDownloadProgress(downloadItemID, Math.floor(downloadItemProgress));
                    break;

                case "complete":
                    updateDownloadProgress(downloadItemID, 100);
                    break;

                case "interrupted":
                    if (downloadItem.paused) {
                        updateDownloadProgress(downloadItemID, -1);
                    } else {
                        updateDownloadProgress(downloadItemID, -100);
                    }
                    break;
            }

        });
    });
}, 1500);


function addDownloadItem(downloadItem) {
    console.log(downloadItem);

    document.getElementById("no_downloads").classList.add("hidden");

    downloadItemIDs.push(downloadItem.id);

    let downloadList = document.getElementById("download_list");

    let downloadItemContainer = document.createElement("div");
    downloadItemContainer.className = "download-item";
    downloadItemContainer.setAttribute("data-id", downloadItem.id);
    downloadItemContainer.setAttribute("data-state", downloadItem.state);
    downloadItemContainer.setAttribute("data-name", downloadItem.filename);

    let downloadItemInfo = document.createElement("div");
    downloadItemInfo.className = "download-item-info";

    let downloadItemTitle = document.createElement("div");
    downloadItemTitle.className = "download-item-title";
    downloadItemTitle.innerText = downloadItem.filename;

    let downloadItemProgress = document.createElement("div");
    downloadItemProgress.className = "download-item-progress";

    let downloadItemProgressBar = document.createElement("div");
    downloadItemProgressBar.className = "download-item-progress-bar skeleton";

    let downloadItemProgressFill = document.createElement("div");
    downloadItemProgressFill.className = "download-item-progress-fill";

    let downloadItemProgressText = document.createElement("div");
    downloadItemProgressText.className = "download-item-progress-text";
    downloadItemProgressText.textContent = "0%";

    downloadItemProgressBar.appendChild(downloadItemProgressFill);
    downloadItemProgress.appendChild(downloadItemProgressBar);
    downloadItemProgress.appendChild(downloadItemProgressText);

    downloadItemInfo.appendChild(downloadItemTitle);
    downloadItemInfo.appendChild(downloadItemProgress);

    let downloadItemControls = document.createElement("div");
    downloadItemControls.className = "download-item-controls";

    let downloadItemAction = document.createElement("a");
    downloadItemAction.className = "download-item-action";
    downloadItemAction.setAttribute("role", "button");

    let pauseIcon = document.createElement("img");
    pauseIcon.src = "images/pause.svg";

    let loadDiv = document.createElement("div");
    loadDiv.className = "load";

    downloadItemAction.appendChild(pauseIcon);
    downloadItemAction.appendChild(loadDiv);

    // Append event handler for pause/resume
    downloadItemAction.addEventListener('click', function () {
        let id = downloadItem.id;
        console.log("Download item action clicked", id);
        let state = downloadItemContainer.getAttribute("data-state")
        console.log("Currently: ", state);
        switch (state) {
            case "in_progress":
                browser.downloads.pause(id).then(() => {
                    console.log("Paused download", id);
                    downloadItemContainer.setAttribute("data-state", "paused");
                    updateDownloadProgress(id, -1);
                }).catch(err => console.error(err));
                break;
            case "paused":
                browser.downloads.resume(id).then(() => {
                    console.log("Resumed download", id);
                    downloadItemContainer.setAttribute("data-state", "in_progress");
                    updateDownloadProgress(id, 0);
                }).catch(err => console.error(err));
                break;
        }
    });

    let downloadItemActionMenu = document.createElement("a");
    downloadItemActionMenu.className = "download-item-action-menu";
    downloadItemActionMenu.setAttribute("role", "button");

    let menuIcon = document.createElement("img");
    menuIcon.src = "images/menu-dots.svg";
    menuIcon.alt = "";

    downloadItemActionMenu.appendChild(menuIcon);

    downloadItemControls.appendChild(downloadItemAction);
    downloadItemControls.appendChild(downloadItemActionMenu);

    downloadItemContainer.appendChild(downloadItemInfo);
    downloadItemContainer.appendChild(downloadItemControls);

    downloadList.appendChild(downloadItemContainer);

    switch (downloadItem.state) {
        case "complete":
            updateDownloadProgress(downloadItem.id, 100);
            break;
        case "interrupted":
            updateDownloadProgress(downloadItem.id, -100);
            break;
        case "in_progress":
            updateDownloadProgress(downloadItem.id, 0);
            break;
        case "paused":
            updateDownloadProgress(downloadItem.id, -1);
            break;
    }
}

function updateDownloadProgress(downloadItemID, progress) {
    const downloadItem = document.querySelector(`.download-item[data-id="${downloadItemID}"]`);

    const downloadItemProgressBar = downloadItem.querySelector(".download-item-progress-bar");
    const downloadItemProgressFill = downloadItem.querySelector(".download-item-progress-fill");
    const downloadItemProgressText = downloadItem.querySelector(".download-item-progress-text");
    const downloadItemAction = downloadItem.querySelector(".download-item-action");
    const actionIcon = downloadItemAction.firstChild;

    switch (progress) {
        // Interrupted
        case -100:
            downloadItem.setAttribute("data-state", "interrupted");

            downloadItemProgressBar.classList.add("hidden");
            downloadItemProgressText.textContent = "Cancelled";

            downloadItemAction.classList.add("hidden");
            break;

        // Paused
        case -1:
            downloadItem.setAttribute("data-state", "paused");

            downloadItemProgressBar.classList.add("hidden");
            downloadItemProgressText.textContent = "Paused";

            actionIcon.src = "images/resume.svg";
            actionIcon.style.display = "block";
            actionIcon.nextElementSibling.classList.add("hidden");
            break;

        // Completed
        case 100:
            downloadItem.setAttribute("data-state", "complete");

            downloadItemProgressBar.classList.add("hidden");
            downloadItemProgressText.textContent = "100% · Finished";

            downloadItemAction.classList.add("hidden");
            downloadItemIDs.splice(downloadItemIDs.indexOf(downloadItemID), 1);
            break;

        // In progress
        default:
            downloadItem.setAttribute("data-state", "in_progress");
            downloadItemAction.classList.remove("hidden");

            actionIcon.src = "images/pause.svg";
            actionIcon.style.display = "none";
            actionIcon.nextElementSibling.classList.remove("hidden");

            downloadItemProgressBar.classList.remove("hidden");
            downloadItemProgressFill.style.width = `${progress}%`;
            downloadItemProgressText.textContent = `${progress}%`;
            break;
    }
}