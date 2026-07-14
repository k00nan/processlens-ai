export function render() {
    return `
        <h1 class="text-3xl font-semibold mb-2">Upload</h1>
        <p class="text-gray-600 mb-6">Laden Sie Ihren Event Log (CSV) hoch und ordnen Sie die Spalten zu.</p>
        <div id="upload-zone" class="max-w-xl border-2 border-dashed border-border-purple rounded-xl p-12 text-center cursor-pointer bg-surface hover:border-primary hover:bg-primary-light transition-colors">
            <span class="material-symbols-outlined text-5xl text-primary mb-3 block">cloud_upload</span>
            <p class="text-purple-700 mb-4">CSV-Datei hierher ziehen oder klicken</p>
            <button id="upload-btn" class="bg-primary-light text-purple-700 border border-border-purple rounded-lg px-5 py-2 cursor-pointer hover:bg-primary-hover transition-colors">Datei auswählen</button>
            <input type="file" id="file-input" accept=".csv" hidden>
        </div>
        <div id="upload-success" class="hidden mt-4 max-w-xl flex items-center gap-2 bg-green-50 text-green-700 rounded-lg px-4 py-3">
            <span class="material-symbols-outlined">check_circle</span>
            <span id="file-name"></span>
        </div>
    `;
}

export function init() {
    const uploadZone = document.getElementById("upload-zone");
    const fileInput = document.getElementById("file-input");
    const uploadBtn = document.getElementById("upload-btn");
    const uploadSuccess = document.getElementById("upload-success");
    const fileName = document.getElementById("file-name");

    uploadBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        fileInput.click();
    });

    uploadZone.addEventListener("click", () => fileInput.click());

    fileInput.addEventListener("change", (e) => {
        if (e.target.files.length > 0) handleFile(e.target.files[0]);
    });

    uploadZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        uploadZone.classList.add("border-primary", "bg-primary-light");
    });

    uploadZone.addEventListener("dragleave", () => {
        uploadZone.classList.remove("border-primary", "bg-primary-light");
    });

    uploadZone.addEventListener("drop", (e) => {
        e.preventDefault();
        uploadZone.classList.remove("border-primary", "bg-primary-light");
        const file = e.dataTransfer.files[0];
        if (file && file.name.endsWith(".csv")) handleFile(file);
    });

    function handleFile(file) {
        fileName.textContent = `Datei erfolgreich geladen: ${file.name}`;
        uploadSuccess.classList.remove("hidden");
    }
}
