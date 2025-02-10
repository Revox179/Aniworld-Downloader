var downloadItemIDs = new Array();

// Handle download state changes (in_progress, complete)
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

    if (downloadDelta.paused) {
        let downloadItemID = downloadDelta.id;
        let downloadItemPaused = downloadDelta.paused.current;

        let downloadItem = document.querySelector(`.download-item[data-id="${downloadItemID}"]`);
        downloadItem.setAttribute("data-paused", downloadItemPaused);
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
        for (let [_key, value] of Object.entries(result)) {
            addDownloadItem(value);
        }
    }
});

// Periodically update download progress
setInterval(() => {
    downloadItemIDs.forEach(downloadItemID => {
        browser.downloads.search({ id: downloadItemID }).then(downloadItems => {
            let downloadItem = downloadItems[0];
            let downloadItemProgress = downloadItem.bytesReceived / downloadItem.totalBytes * 100;

            updateDownloadProgress(downloadItemID, Math.floor(downloadItemProgress));
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

    let downloadItemActions = document.createElement("div");
    downloadItemActions.className = "download-item-actions";

    let downloadItemActionCancel = document.createElement("a");
    downloadItemActionCancel.className = "download-item-action-cancel";
    downloadItemActionCancel.setAttribute("role", "button");

    let cancelIcon = document.createElement("img");
    cancelIcon.className = "cancel-icon";
    cancelIcon.src = "images/cancel.svg";
    cancelIcon.alt = "";

    let loadDiv = document.createElement("div");
    loadDiv.className = "load";

    downloadItemActionCancel.appendChild(cancelIcon);
    downloadItemActionCancel.appendChild(loadDiv);

    let downloadItemActionMenu = document.createElement("a");
    downloadItemActionMenu.className = "download-item-action-menu";
    downloadItemActionMenu.setAttribute("role", "button");

    let menuIcon = document.createElement("img");
    menuIcon.src = "images/menu-dots.svg";
    menuIcon.alt = "";

    downloadItemActionMenu.appendChild(menuIcon);

    downloadItemActions.appendChild(downloadItemActionCancel);
    downloadItemActions.appendChild(downloadItemActionMenu);

    downloadItemContainer.appendChild(downloadItemInfo);
    downloadItemContainer.appendChild(downloadItemActions);

    downloadList.appendChild(downloadItemContainer);
}

function updateDownloadProgress(downloadItemID, progress) {
    let downloadItem = document.querySelector(`.download-item[data-id="${downloadItemID}"]`);
    let downloadItemProgressFill = downloadItem.querySelector(".download-item-progress-fill");
    let downloadItemProgressText = downloadItem.querySelector(".download-item-progress-text");

    downloadItemProgressFill.style.width = `${progress}%`;
    downloadItemProgressText.textContent = `${progress}%`;
}