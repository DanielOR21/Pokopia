const ZONES = [
    
    "Withered Wastelands",
    "Bleak Beach",
    "Rocky Ridges",
    "Sparkling Skylands",
    "Palette Town",
    "Bubbly Basin",
];

let pokemon = [];
let habitats = [];
let userData = {};
let currentPokemon = null;
let specialties = [];

const habitatMap = {};

const EVENT_ID_OFFSET = 10000;

function getRealPokopiaId(id) {

    return id > EVENT_ID_OFFSET
        ? id - EVENT_ID_OFFSET
        : id;

}

async function loadData() {

    pokemon = await fetch("/data/pokemon.json").then(r => r.json());
    habitats = await fetch("/data/habitats.json").then(r => r.json());
    const savedData = localStorage.getItem("pokopia-user-data");

    userData = savedData
        ? JSON.parse(savedData)
        : {};

    habitats.forEach(h => habitatMap[h.key] = h);

    specialties = [...new Set(
        pokemon.flatMap(p => p.specialties)
    )].sort();

    createSpecialties();
    createZones();

    renderHabitats(habitats);

    updateFilterCounts();
    updateHabitatProgress();

    clearFilters();
    applyFilters();

    showBrowserTab("pokemon");

}

function createZones() {

    const container = document.getElementById("zones");
    container.innerHTML = "";

    const none = document.createElement("img");

    none.src = "/icons/None.png";
    none.alt = "Sin zona";
    none.title = "Sin zona";
    none.className = "filter-zone";
    none.dataset.zone = "";

    none.onclick = () => {
        none.classList.toggle("selected");
        applyFilters();
    };

    const wrapper = document.createElement("div");

    wrapper.className = "filter-zone-wrapper";

    const count = document.createElement("span");

    count.className = "filter-zone-count";

    count.id = "count-none";

    wrapper.appendChild(none);
    wrapper.appendChild(count);

    container.appendChild(wrapper);

    ZONES.forEach(zone => {

        const img = document.createElement("img");

        img.src = `/icons/${zone}.png`;
        img.alt = zone;
        img.title = zone;
        img.className = "filter-zone";
        img.dataset.zone = zone;

        img.onclick = () => {
            img.classList.toggle("selected");
            applyFilters();
        };

        img.onerror = () => img.style.display = "none";
        const wrapper = document.createElement("div");

        wrapper.className = "filter-zone-wrapper";

        const count = document.createElement("span");

        count.className = "filter-zone-count";

        count.id = `count-${zone}`;

        wrapper.appendChild(img);
        wrapper.appendChild(count);

        container.appendChild(wrapper);

    });

}

function renderPokemon(list) {

    const grid = document.getElementById("pokemon-grid");

    grid.innerHTML = "";

    list.forEach(p => {

        const card = document.createElement("div");

        card.className = "pokemon-card";
        card.dataset.key = p.key;

        if (userData[p.key]?.completed) {
            card.classList.add("completed");
        }

        card.innerHTML = `
            <div class="image-container">
                <img
                    src="https://www.serebii.net/pokemonpokopia/pokemon/small/${p.image}.png"
                    alt="${p.name}"
                    title="${p.name}">
            </div>
        `;

        card.onclick = () => openPokemon(p);

        grid.appendChild(card);

    });

}

function applyFilters() {

    const search = document
        .getElementById("search")
        .value
        .toLowerCase();

    const selectedSpecialties = [
        ...document.querySelectorAll(
            "#specialties .filter-specialty.selected"
        )
    ].map(img => img.dataset.specialty);

    const showCompleted =
        document.getElementById("filter-completed").checked;

    const showNotCompleted =
        document.getElementById("filter-not-completed").checked;

    const showPossibleHabitat =
        document.getElementById("filter-possible-habitat").checked;

    const showOtherHabitat =
        document.getElementById("filter-other-habitat").checked;

    const showNoHabitat =
        document.getElementById("filter-no-habitat").checked;

    const selectedZones = [
        ...document.querySelectorAll("#zones .filter-zone.selected")
    ].map(img => img.dataset.zone);

    const showWithNotes =
        document.getElementById("filter-with-notes").checked;

    const showWithoutNotes =
        document.getElementById("filter-without-notes").checked;


    const filtered = pokemon.filter(p => {

        // Buscar por nombre
        if (!p.name.toLowerCase().includes(search)) {
            return false;
        }

        // Buscar por Especialidad
        if (selectedSpecialties.length > 0) {

            if (!p.specialties.some(s =>
                selectedSpecialties.includes(s)
            )) {

                return false;

            }

        }

        const completed = userData[p.key]?.completed || false;

        // Solo conseguidos
        if (showCompleted && !showNotCompleted && !completed) {
            return false;
        }

        // Solo sin conseguir
        if (showNotCompleted && !showCompleted && completed) {
            return false;
        }

        // Hábitat
        const selectedHabitat = userData[p.key]?.habitat || "";

        const isNoHabitat = selectedHabitat === "";

        const isPossibleHabitat =
            !isNoHabitat &&
            p.locations.some(l => l.habitat === selectedHabitat);

        const isOtherHabitat =
            !isNoHabitat &&
            !isPossibleHabitat;

        // Filtro hábitat
        if (
            (showPossibleHabitat || showOtherHabitat || showNoHabitat) &&
            !(
                (showPossibleHabitat && isPossibleHabitat) ||
                (showOtherHabitat && isOtherHabitat) ||
                (showNoHabitat && isNoHabitat)
            )
        ) {
            return false;
        }

        const hasNotes = (userData[p.key]?.notes || "").trim() !== "";

        // Solo con notas
        if (showWithNotes && !showWithoutNotes && !hasNotes) {
            return false;
        }

        // Solo sin notas
        if (showWithoutNotes && !showWithNotes && hasNotes) {
            return false;
        }

        // Filtrar por zona
        if (selectedZones.length > 0) {
            const zone = userData[p.key]?.zone || "";
            if (!selectedZones.includes(zone)) {
                return false;
            }
        }

        return true;

    });

    renderPokemon(filtered);

    updateFilterTitles();
}

function applyHabitatFilters() {

    let filtered = [...habitats];

    // Buscar
    const search = document
        .getElementById("habitat-search-sidebar")
        .value
        .toLowerCase()
        .trim();

    if (search) {

        filtered = filtered.filter(h =>
            h.name.toLowerCase().includes(search)
        );

    }

    // Estado
    const completed =
        document.getElementById("filter-habitat-completed").checked;

    const empty =
        document.getElementById("filter-habitat-empty").checked;

    if (completed !== empty) {

        filtered = filtered.filter(h => {

            const hasPokemon = pokemon.some(p =>
                userData[p.key]?.habitat === h.key
            );

            return completed
                ? hasPokemon
                : !hasPokemon;

        });

    }

    renderHabitats(filtered);

}

function showPokemon(p) {

    currentPokemon = p;

    if (!userData[p.key]) {

        userData[p.key] = {
            completed: false,
            zone: "",
            habitat: "",
            notes: ""
        };

    }

    updateCompletedButton();
    
    document.getElementById("editor-empty").hidden = true;
    document.getElementById("pokemon-editor").hidden = false;
    document.getElementById("habitat-editor").hidden = true;

    document.getElementById("editor-image").src =
        `https://www.serebii.net/pokemonpokopia/pokemon/${p.image}.png`;

    const pokemonLink = document.getElementById("editor-name");

    pokemonLink.textContent = p.name;
    pokemonLink.href = `https://www.serebii.net/pokemonpokopia/pokedex/${p.key}.shtml`;

    renderSpecialties(p);
    renderLocations(p);
    renderZones();

    document.getElementById("editor-notes").value =
    userData[p.key].notes || "";

    if (userData[p.key].habitat) {

        selectHabitat(userData[p.key].habitat, false);

        const habitat = habitatMap[userData[p.key].habitat];

        const link = document.getElementById("selected-habitat-link");

        link.onclick = () => {

            showBrowserTab("habitat");
            openHabitat(habitat);

        };

    } else {

        const img = document.getElementById("selected-habitat-image");

        img.hidden = true;
        img.removeAttribute("src");

        document.getElementById("selected-habitat-name").textContent = "";

        const link = document.getElementById("selected-habitat-link");
        if (link) link.href = "";

    }

}

function renderSpecialties(p) {

    const container = document.getElementById("editor-specialties");

    container.innerHTML = "";

    p.specialties.forEach(s => {

        const img = document.createElement("img");

        if (s === "???") {

            img.src = "/icons/None.png";

        } else {

            img.src =
                `https://www.serebii.net/pokemonpokopia/pokedex/specialty/${s.toLowerCase().replaceAll(" ", "")}.png`;

        }

        img.title = s;

        container.appendChild(img);

    });

}

function renderLocations(p) {

    const container = document.getElementById("editor-locations");

    container.innerHTML = "";

    if (!p.locations) return;

    p.locations.forEach(location => {

        const habitat = habitatMap[location.habitat];

        if (!habitat) return;

        const wrapper = document.createElement("div");

        wrapper.className = "location-wrapper";

        const img = document.createElement("img");

        img.src = `https://www.serebii.net/pokemonpokopia/habitatdex/${habitat.image}.png`;

        img.className = "location-image";

        img.title = habitat.name;

        img.onclick = () => selectHabitat(location.habitat);

        img.onmouseenter = () => {

            const tooltip = document.getElementById("habitat-tooltip");
            tooltip.hidden = false;

            tooltip.style.display = "flex";
            document.getElementById("tooltip-rarity").textContent =
                location.rarity;

            document.getElementById("tooltip-time").innerHTML =
                location.time.length
                    ? location.time.join("<br>")
                    : "Cualquiera";

            document.getElementById("tooltip-weather").innerHTML =
                location.weather.length
                    ? location.weather.join("<br>")
                    : "Cualquiera";

            const zones = document.getElementById("tooltip-zones");
                if (location.zones.length === 0) {
                    zones.innerHTML = `
                        <img
                            src="/icons/None.png"
                            class="tooltip-zone-image"
                            title="Sin zona"
                            alt="Sin zona">
                    `;
                } else {
                    zones.innerHTML = location.zones
                        .filter(zone => ZONES.includes(zone.name))
                        .map(zone => `
                            <img
                                src="/icons/${zone.name}.png"
                                class="tooltip-zone-image"
                                title="${zone.name}"
                                alt="${zone.name}">
                        `)
                        .join("");
                }

            const rect = img.getBoundingClientRect();

            tooltip.style.left = `${rect.left + window.scrollX -60}px`;
            tooltip.style.top = `${rect.bottom + window.scrollY + 6}px`;

        };

        img.onmouseleave = () => {

            const tooltip = document.getElementById("habitat-tooltip");

            tooltip.hidden = true;

            tooltip.style.display = "none";

        };

        const openButton = document.createElement("button");

        openButton.className = "location-link";

        openButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg"
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2">
                <path d="M7 17L17 7"/>
                <path d="M8 7h9v9"/>
            </svg>
        `;

        openButton.onclick = e => {

            e.stopPropagation();

            showBrowserTab("habitat");
            openHabitat(habitat);

        };

        wrapper.appendChild(img);

        wrapper.appendChild(openButton);

        container.appendChild(wrapper);

    });

}

function renderZones() {

    const container = document.getElementById("editor-zones");

    container.innerHTML = "";

    const none = document.createElement("img");

    none.src = "/icons/None.png";
    none.alt = "Sin zona";
    none.title = "Sin zona";

    none.className = "zone-icon";

    if (currentPokemon && (userData[currentPokemon.key]?.zone || "") === "") {
        none.classList.add("selected");
    }

    none.onclick = async () => {
        document.querySelectorAll(".zone-icon")
            .forEach(i => i.classList.remove("selected"));
        none.classList.add("selected");
        userData[currentPokemon.key].zone = "";
        await saveUserData();
    };

    container.appendChild(none);

    ZONES.forEach(zone => {

        const img = document.createElement("img");

        img.src = `/icons/${zone}.png`;
        img.alt = zone;
        img.title = zone;

        img.className = "zone-icon";

        if (
            currentPokemon &&
            userData[currentPokemon.key]?.zone === zone
        ) {
            img.classList.add("selected");
        }

        img.onerror = () => {
            img.style.display = "none";
        };

        img.onclick = async () => {

            document.querySelectorAll(".zone-icon")
                .forEach(i => i.classList.remove("selected"));

            img.classList.add("selected");

            userData[currentPokemon.key].zone = zone;

            updateFilterCounts();

            await saveUserData();

        };

        container.appendChild(img);

    });

}

let currentHabitat = null;

function showHabitat(habitat){

    currentHabitat = habitat;

    document.getElementById("editor-empty").hidden = true;
    document.getElementById("pokemon-editor").hidden = true;
    document.getElementById("habitat-editor").hidden = false;

    // Nombre + enlace
    const habitatLink = document.getElementById("habitat-name");

    habitatLink.textContent = habitat.name;
    habitatLink.href =
        `https://www.serebii.net/pokemonpokopia/habitatdex/${habitat.key}.shtml`;

    // Imagen
    document.getElementById("habitat-image").src =
        `https://www.serebii.net/pokemonpokopia/habitatdex/${habitat.image}.png`;

    renderHabitatAssigned(habitat);
    renderHabitatPossible(habitat);
    renderHabitatMaterials(habitat);

}

function renderHabitatAssigned(habitat){

    const assigned = pokemon.filter(p =>
        userData[p.key]?.habitat === habitat.key
    );

    document.getElementById("habitat-assigned-count").textContent =
        `(${assigned.length})`;

    renderPokemonList("habitat-assigned", assigned);

}

function renderHabitatPossible(habitat){

    const possible = pokemon.filter(p =>
        p.locations?.some(location => location.habitat === habitat.key)
    );

    document.getElementById("habitat-possible-count").textContent =
        `(${possible.length})`;

    renderPokemonList("habitat-possible", possible);

    const images = document.querySelectorAll("#habitat-possible img");

    images.forEach((img, index) => {

        const p = possible[index];

        const location = p.locations.find(
            l => l.habitat === habitat.key
        );

        img.onmouseenter = () => {
            const tooltip = document.getElementById("habitat-tooltip");

            tooltip.hidden = false;
            tooltip.style.display = "flex";

            document.getElementById("tooltip-rarity").textContent =
                location.rarity;

            document.getElementById("tooltip-time").innerHTML =
                location.time.length
                    ? location.time.join("<br>")
                    : "Cualquiera";

            document.getElementById("tooltip-weather").innerHTML =
                location.weather.length
                    ? location.weather.join("<br>")
                    : "Cualquiera";

            const zones = document.getElementById("tooltip-zones");

            if (location.zones.length === 0) {

                zones.innerHTML = `
                    <img
                        src="/icons/None.png"
                        class="tooltip-zone-image"
                        title="Sin zona"
                        alt="Sin zona">
                `;

            } else {

                zones.innerHTML = location.zones
                    .filter(zone => ZONES.includes(zone.name))
                    .map(zone => `
                        <img
                            src="/icons/${zone.name}.png"
                            class="tooltip-zone-image"
                            title="${zone.name}"
                            alt="${zone.name}">
                    `)
                    .join("");

            }

            const rect = img.getBoundingClientRect();

            tooltip.style.left = `${rect.left + window.scrollX - 60}px`;
            tooltip.style.top = `${rect.bottom + window.scrollY + 6}px`;
        };

        img.onmouseleave = () => {
            const tooltip = document.getElementById("habitat-tooltip");

            tooltip.hidden = true;
            tooltip.style.display = "none";
        };

    });

}

function renderPokemonList(containerId, list) {

    const container = document.getElementById(containerId);

    container.innerHTML = "";

    list.forEach(p => {

        const img = document.createElement("img");

        img.src =
            `https://www.serebii.net/pokemonpokopia/pokemon/small/${p.image}.png`;

        img.alt = p.name;
        img.title = p.name;

        img.onclick = () => {

            showBrowserTab("pokemon");
            openPokemon(p);

        };

        container.appendChild(img);

    });

}

function renderHabitatMaterials(habitat){

    const container = document.getElementById("habitat-materials");

    container.innerHTML = "";

    habitat.materials.forEach(material => {

        const wrapper = document.createElement("div");

        wrapper.className = "habitat-material";

        wrapper.onclick = () => {

            window.open(
                `https://www.serebii.net/pokemonpokopia/items/${material.key}.shtml`,
                "_blank"
            );

        };

        wrapper.innerHTML = `
            <img
                src="https://www.serebii.net/pokemonpokopia/items/${material.key}.png"
                alt="${material.name}"
                title="${material.name}"
                onerror="this.onerror=null;this.src='/icons/None.png';">

            <div>${material.name}</div>

            ${
                material.quantity != null
                    ? `<span>x${material.quantity}</span>`
                    : ""
            }
        `;

        container.appendChild(wrapper);

    });

}

// =========================
// Modal
// =========================

const habitatModal = document.getElementById("habitat-modal");
const habitatList = document.getElementById("habitat-list");
const habitatSearch = document.getElementById("habitat-search");

document.getElementById("other-habitats-button").addEventListener("click", () => {

    habitatSearch.value = "";

    renderHabitatModal(habitats);

    habitatModal.hidden = false;

});

document.getElementById("close-habitat-modal").addEventListener("click", () => {

    habitatModal.hidden = true;

});

habitatModal.addEventListener("click", e => {

    if (e.target === habitatModal) {

        habitatModal.hidden = true;

    }

});

habitatSearch.addEventListener("input", () => {

    const text = habitatSearch.value.toLowerCase();

    renderHabitatModal(

        habitats.filter(h =>
            h.name.toLowerCase().includes(text)
        )

    );

});

function renderHabitatModal(list) {

    habitatList.innerHTML = "";

    list.forEach(h => {

        const card = document.createElement("div");

        card.className = "habitat-card";

        const hasPokemon = pokemon.some(p =>
            userData[p.key]?.habitat === h.key
        );

        if (hasPokemon) {
            card.classList.add("habitat-modal-//completed");
        }

        card.onclick = () => {

            habitatModal.hidden = true;

            selectHabitat(h.key);

        };

        const wrapper = document.createElement("div");

        wrapper.className = "location-wrapper";

        const img = document.createElement("img");

        img.src = `https://www.serebii.net/pokemonpokopia/habitatdex/${h.image}.png`;

        img.alt = h.name;

        const openButton = document.createElement("button");

        openButton.className = "location-link";

        openButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg"
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2">
                <path d="M7 17L17 7"/>
                <path d="M8 7h9v9"/>
            </svg>
        `;

        openButton.onclick = e => {

            e.stopPropagation();

            showBrowserTab("habitat");
            openHabitat(h);

        };

        wrapper.appendChild(img);
        wrapper.appendChild(openButton);

        const name = document.createElement("span");

        name.textContent = h.name;

        card.appendChild(wrapper);
        card.appendChild(name);

        habitatList.appendChild(card);

    });

}

async function selectHabitat(key, save = true) {
    // Si ya estaba seleccionado, lo quitamos
    if (save && userData[currentPokemon.key].habitat === key) {

        userData[currentPokemon.key].habitat = "";

        document.querySelectorAll(".location-image").forEach(img => {
            img.style.border = "2px solid transparent";
        });

        const img = document.getElementById("selected-habitat-image");

        img.hidden = true;
        img.removeAttribute("src");

        document.getElementById("selected-habitat-name").textContent = "";

        const link = document.getElementById("selected-habitat-link");
        if (link) {
            link.href = "";
        }

        updateHabitatProgress();

        if (save) {
            await saveUserData();
        }

        return;
    }

    document.querySelectorAll(".location-image").forEach(img => {
        img.style.border = "2px solid transparent";
    });

    const habitat = habitatMap[key];

    if (!habitat) return;

    document.querySelectorAll(".location-image").forEach(img => {

        if (img.title === habitat.name) {
            img.style.border = "3px solid #4CAF50";
        }

    });

    const selectedImage = document.getElementById("selected-habitat-image");

    selectedImage.hidden = false;
    selectedImage.src =
        `https://www.serebii.net/pokemonpokopia/habitatdex/${habitat.image}.png`;

    document.getElementById("selected-habitat-name").textContent =
        habitat.name;

    const link = document.getElementById("selected-habitat-link");

    if (link) {
        link.href = `https://www.serebii.net/pokemonpokopia/habitatdex/${habitat.key}.shtml`;
    }

    userData[currentPokemon.key].habitat = key;

    updateHabitatProgress();

    if (save) {
        await saveUserData();
    }

}

function updateCompletedButton() {

    const button = document.getElementById("editor-completed");

    if (userData[currentPokemon.key].completed) {

        button.textContent = "✅ Conseguido";

        button.classList.add("completed");
        button.classList.remove("not-completed");

    } else {

        button.textContent = "⭕ Sin conseguir";

        button.classList.add("not-completed");
        button.classList.remove("completed");

    }

}

function saveUserData() {

    localStorage.setItem(
        "pokopia-user-data",
        JSON.stringify(userData)
    );

}

function updatePokemonCard(key) {

    const card = document.querySelector(
        `.pokemon-card[data-key="${key}"]`
    );

    if (!card) return;

    card.classList.toggle(
        "completed",
        userData[key]?.completed
    );

}

function clearFilters() {

    // Pokémon
    document.getElementById("search").value = "";

    document
        .querySelectorAll("#specialties .filter-specialty")
        .forEach(img => img.classList.remove("selected"));

    document.getElementById("filter-completed").checked = false;
    document.getElementById("filter-not-completed").checked = false;

    document.getElementById("filter-possible-habitat").checked = false;
    document.getElementById("filter-other-habitat").checked = false;
    document.getElementById("filter-no-habitat").checked = false;

    document
        .querySelectorAll("#zones .filter-zone.selected")
        .forEach(img => img.classList.remove("selected"));

    document.getElementById("filter-with-notes").checked = false;
    document.getElementById("filter-without-notes").checked = false;

    // Hábitats
    document.getElementById("habitat-search-sidebar").value = "";

    document.getElementById("filter-habitat-completed").checked = false;
    document.getElementById("filter-habitat-empty").checked = false;

    // Aplicar los filtros de la pestaña visible
    if (!document.getElementById("pokemon-grid").hidden) {

        applyFilters();

    } else {

        applyHabitatFilters();

    }

}

function updateHabitatProgress() {

    // Hábitats únicos elegidos
    const completedHabitats = new Set();

    Object.values(userData).forEach(data => {

        if (data.habitat) {
            completedHabitats.add(data.habitat);
        }

    });

    const completed = completedHabitats.size;
    const total = habitats.length;

    document.getElementById("habitat-progress-text").textContent =
        `${completed} / ${total}`;

    document.getElementById("habitat-progress-bar").style.width =
        `${completed / total * 100}%`;

}

function updateFilterCounts() {

    specialties.forEach(specialty => {

        const count = pokemon.filter(p =>
            p.specialties.includes(specialty)
        ).length;

        document.getElementById(
            `count-specialty-${specialty.replaceAll(" ","-")}`
        ).textContent = count;

    });

    const completed = pokemon.filter(
        p => userData[p.key]?.completed
    ).length;

    const notCompleted = pokemon.length - completed;

    // Barra de progreso de Pokémon
    const percent = (completed / pokemon.length) * 100;

    document.getElementById("pokemon-progress-text").textContent =
        `${completed} / ${pokemon.length}`;

    document.getElementById("pokemon-progress-bar").style.width =
        `${percent}%`;

    document.getElementById("completed-count").textContent =
        `Conseguidos (${completed})`;

    document.getElementById("not-completed-count").textContent =
        `Sin conseguir (${notCompleted})`;

    //Habitats

    const possibleHabitat = pokemon.filter(p => {
        const habitat = userData[p.key]?.habitat;
        return habitat &&
            p.locations.some(l => l.habitat === habitat);
    }).length;

    const otherHabitat = pokemon.filter(p => {
        const habitat = userData[p.key]?.habitat;
        return habitat &&
            !p.locations.some(l => l.habitat === habitat);
    }).length;

    const noHabitat = pokemon.length - possibleHabitat - otherHabitat;

    document.getElementById("possible-habitat-count").textContent =
        `Hábitat posible (${possibleHabitat})`;
    document.getElementById("other-habitat-count").textContent =
        `Otro hábitat (${otherHabitat})`;
    document.getElementById("no-habitat-count").textContent =
        `Sin hábitat (${noHabitat})`;

    // Sin zona
    const noneCount = pokemon.filter(
        p => (userData[p.key]?.zone || "") === ""
    ).length;

    document.getElementById("count-none").textContent = noneCount;

    // Cada zona
    ZONES.forEach(zone => {

        const count = pokemon.filter(
            p => (userData[p.key]?.zone || "") === zone
        ).length;

        document.getElementById(`count-${zone}`).textContent = count;

    });
    
    const withNotes = pokemon.filter(
        p => (userData[p.key]?.notes || "").trim() !== ""
    ).length;
    const withoutNotes = pokemon.length - withNotes;

    document.getElementById("with-notes-label").textContent =
        `Con notas (${withNotes})`;
    document.getElementById("without-notes-label").textContent =
        `Sin notas (${withoutNotes})`;

    }

function updateFilterTitles() {

    // Estado
    const completed =
        document.getElementById("filter-completed").checked;

    const notCompleted =
        document.getElementById("filter-not-completed").checked;

    document.querySelector("#status-filter summary").textContent =
        (completed || notCompleted)
            ? "Estado · Activo"
            : "Estado";

    // Zonas
    const hasZones =
        document.querySelectorAll("#zones .filter-zone.selected").length > 0;

    document.querySelector("#zones-filter summary").textContent =
        hasZones
            ? "Zonas · Activo"
            : "Zonas";

    // Notas
    const notesActive =
        document.getElementById("filter-with-notes").checked ||
        document.getElementById("filter-without-notes").checked;

    document.querySelector("#notes-filter summary").textContent =
        notesActive ? "Notas (Activo)" : "Notas";

}

function createSpecialties() {

    const container = document.getElementById("specialties");

    container.innerHTML = "";

    specialties.forEach(specialty => {

        const img = document.createElement("img");

        if (specialty === "???") {

            img.src = "/icons/None.png";

        } else {

            img.src =
                `https://www.serebii.net/pokemonpokopia/pokedex/specialty/${specialty.toLowerCase().replaceAll(" ", "")}.png`;

        }

        img.className = "filter-specialty";

        img.title = specialty;

        img.dataset.specialty = specialty;

        img.onclick = () => {

            img.classList.toggle("selected");

            applyFilters();

        };

        const wrapper = document.createElement("div");

        wrapper.className = "filter-specialty-wrapper";

        const count = document.createElement("span");

        count.className = "filter-specialty-count";

        count.id = `count-specialty-${specialty.replaceAll(" ","-")}`;

        wrapper.appendChild(img);
        wrapper.appendChild(count);

        container.appendChild(wrapper);

    });

}

function showBrowserTab(tab){

    const pokemonGrid = document.getElementById("pokemon-grid");
    const habitatGrid = document.getElementById("habitat-grid");

    const pokemonFilters = document.getElementById("pokemon-filters-panel");
    const habitatFilters = document.getElementById("habitat-filters-panel");

    if(tab === "pokemon"){

        pokemonGrid.hidden = false;
        habitatGrid.hidden = true;

        pokemonFilters.hidden = false;
        habitatFilters.hidden = true;

        document.getElementById("pokemon-tab").classList.add("active");
        document.getElementById("habitat-tab").classList.remove("active");

        applyFilters();

    }else{

        pokemonGrid.hidden = true;
        habitatGrid.hidden = false;

        pokemonFilters.hidden = true;
        habitatFilters.hidden = false;

        document.getElementById("pokemon-tab").classList.remove("active");
        document.getElementById("habitat-tab").classList.add("active");

        applyHabitatFilters();

    }

}

function renderHabitats(list = habitats){

    const grid = document.getElementById("habitat-grid");

    grid.innerHTML = "";

    list.forEach(habitat => {

        const card = document.createElement("div");
        card.className = "habitat-browser-card";

        const image = document.createElement("img");
        image.className = "habitat-browser-image";
        image.src =
            `https://www.serebii.net/pokemonpokopia/habitatdex/${habitat.image}.png`;

        const name = document.createElement("div");
        name.className = "habitat-browser-name";
        name.textContent = habitat.name;

        const pokemonContainer = document.createElement("div");
        pokemonContainer.className = "habitat-browser-pokemon";

        let hasPokemon = false;

        pokemon.forEach(p => {

            if (!userData[p.key]) return;

            if(userData[p.key].habitat !== habitat.key) return;

            hasPokemon = true;

            const img = document.createElement("img");

            img.src = `https://www.serebii.net/pokemonpokopia/pokemon/small/${p.image}.png`;
            img.title = p.name;
            img.alt = p.name;

            img.onclick = () => {

                showBrowserTab("pokemon");
                openPokemon(p);

            };

            pokemonContainer.appendChild(img);

        });

        card.appendChild(image);
        card.appendChild(name);
        card.appendChild(pokemonContainer);

        if (hasPokemon) {
            card.classList.add("habitat-completed");
        }

        card.onclick = () => openHabitat(habitat);

        grid.appendChild(card);

    });

}

let navigationHistory = [];

function openPokemon(p){

    history.pushState(
        {
            type: "pokemon",
            key: p.key
        },
        ""
    );

    showBrowserTab("pokemon");

    showPokemon(p);
}

function openHabitat(h){

    history.pushState(
        {
            type: "habitat",
            key: h.key
        },
        ""
    );

    showBrowserTab("habitat");

    showHabitat(h);
}

function goBack(){

    if(navigationHistory.length === 0) return;

    const previous = navigationHistory.pop();

    if(previous.type === "pokemon"){

        showBrowserTab("pokemon");
        showPokemon(previous.data);

    }else{

        showBrowserTab("habitat");
        showHabitat(previous.data);

    }

}

window.addEventListener("popstate", e => {

    if (!e.state) return;

    if (e.state.type === "pokemon") {

        const p = pokemon.find(x => x.key === e.state.key);

        showBrowserTab("pokemon");
        showPokemon(p);

    } else if (e.state.type === "habitat") {

        const habitat = habitats.find(x => x.key === e.state.key);

        showBrowserTab("habitat");
        showHabitat(habitat);

    }

});

document
.getElementById("editor-completed")
.addEventListener("click", async () => {

    if (!currentPokemon) return;

    userData[currentPokemon.key].completed =
        !userData[currentPokemon.key].completed;

    updateCompletedButton();

    updatePokemonCard(currentPokemon.key);

    updateFilterCounts();

    await saveUserData();

});

document
.getElementById("editor-notes")
.addEventListener("change", async e => {

    if (!currentPokemon) return;

    userData[currentPokemon.key].notes = e.target.value;

    updateFilterCounts();

    await saveUserData();

});

document
.getElementById("search")
.addEventListener("input", applyFilters);

document
.getElementById("clear-filters")
.addEventListener("click", clearFilters);

document
.getElementById("filter-completed")
.addEventListener("change", applyFilters);

document
.getElementById("filter-not-completed")
.addEventListener("change", applyFilters);

document
.getElementById("filter-with-notes")
.addEventListener("change", applyFilters);

document
.getElementById("filter-without-notes")
.addEventListener("change", applyFilters);

document
.getElementById("filter-possible-habitat")
.addEventListener("change", applyFilters);

document
.getElementById("filter-other-habitat")
.addEventListener("change", applyFilters);

document
.getElementById("filter-no-habitat")
.addEventListener("change", applyFilters);

document
.getElementById("pokemon-tab")
.addEventListener("click", () => showBrowserTab("pokemon"));

document
.getElementById("habitat-tab")
.addEventListener("click", () => showBrowserTab("habitat"));

document
.getElementById("habitat-search-sidebar")
.addEventListener("input", applyHabitatFilters);

document
.getElementById("filter-habitat-completed")
.addEventListener("change", applyHabitatFilters);

document
.getElementById("filter-habitat-empty")
.addEventListener("change", applyHabitatFilters);

loadData();