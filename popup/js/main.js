const tabs = document.querySelectorAll(".tab");
const pages = document.querySelectorAll(".page");

tabs.forEach(tab => {
    tab.addEventListener("click", () => {
        tabs.forEach(t => t.classList.remove("selected"));
        tab.classList.add("selected");

        const targetPageId = tab.getAttribute("data-target");
        pages.forEach(page => {
            if (page.id === targetPageId) {
                page.classList.remove("hidden");
            } else {
                page.classList.add("hidden");
            }
        });
    });
});