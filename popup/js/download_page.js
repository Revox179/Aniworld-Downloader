var downloadItemIDs = new Array();

// Handle download state changes (in_progress, complete, paused)
browser.downloads.onChanged.addListener(downloadDelta => {
    console.log(downloadDelta);

    if (downloadDelta.state) {
        let downloadItemID = downloadDelta.id;
        let downloadItemState = downloadDelta.state.current;

        let downloadItem = document.querySelector(`.download-item[data-id="${downloadItemID}"]`);
        downloadItem.setAttribute("data-state", downloadItemState);

        if (downloadItemState === "in_progress") {
            downloadItem.querySelector(".download-item-progress-bar").classList.remove("skeleton");
        } else if (downloadItemState === "complete") {
            downloadItem.querySelector(".download-item-progress-bar").classList.add("complete");
        }
    }

    if (downloadDelta?.paused?.current) {
        let downloadItemID = downloadDelta.id;

        let downloadItem = document.querySelector(`.download-item[data-id="${downloadItemID}"]`);
        downloadItem.setAttribute("data-state", "paused");
    }
});

// Handle storage changes (new downloads)
browser.storage.local.onChanged.addListener(changes => {
    for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
        if (!isNaN(key)) {
            console.log(`The key "${key}" is a number.`);
            console.log(`Old value: ${oldValue}`);
            console.log(`New value: ${newValue}`);

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
    downloadItemAction.addEventListener('click', function() {
        let id = downloadItem.id;
        switch (downloadItemContainer.getAttribute("data-state")) {
            case "in_progress":
                downloadItemContainer.setAttribute("data-state", "paused");
                browser.downloads.pause(id).then(() => {
                    console.log("Pause download", id);
                }).catch(err => console.error(err));
                updateDownloadProgress(id, -1);
                break;
            case "paused":
                downloadItemContainer.setAttribute("data-state", "in_progress");
                browser.downloads.resume(id).then(() => {
                    console.log("Resumed download", id);
                }).catch(err => console.error(err));
                updateDownloadProgress(id, 0);
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

            downloadItemProgressBar.remove();
            downloadItemProgressText.textContent = "Cancelled";

            downloadItemAction.style.visibility = "hidden";
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
            downloadItemProgressBar.classList.add("complete");
            downloadItemAction.classList.add("hidden");
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