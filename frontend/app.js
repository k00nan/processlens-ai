import * as upload from "./pages/upload.js";
import * as uebersicht from "./pages/uebersicht.js";
import * as prozessanalyse from "./pages/prozessanalyse.js";
import * as kiAuswertung from "./pages/ki-auswertung.js";

const pages = {
    upload,
    uebersicht,
    prozessanalyse,
    "ki-auswertung": kiAuswertung,
};

const content = document.getElementById("content");
const navButtons = document.querySelectorAll(".nav-btn");

function navigateTo(pageId) {
    const page = pages[pageId];
    if (!page) return;

    navButtons.forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.page === pageId);
    });

    content.innerHTML = page.render();
    page.init();
}

navButtons.forEach((btn) => {
    btn.addEventListener("click", () => navigateTo(btn.dataset.page));
});

navigateTo("upload");
