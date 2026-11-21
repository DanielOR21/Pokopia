const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

const NORMAL_URL = "https://www.serebii.net/pokemonpokopia/availablepokemon.shtml";
const BASIN_URL = "https://www.serebii.net/pokemonpokopia/basinpokedex.shtml";
const EVENT_URL = "https://www.serebii.net/pokemonpokopia/eventpokedex.shtml";

const EVENT_ID_OFFSET = 10000;
const BASE_URL = "https://www.serebii.net";
const OUTPUT_PATH = path.join(__dirname, "../data/pokemon.json");

function splitValues(text) {
    const value = text.trim().replace(/\s+/g, "");
    if (!value || value === "-") {
        return [];
    }
    return value.split(/(?=[A-Z])/);
}

function loadExistingLocationsMap(filePath) {
    const map = new Map();
    if (!fs.existsSync(filePath)) {
        return map;
    }

    try {
        const existing = JSON.parse(fs.readFileSync(filePath, "utf8"));
        if (Array.isArray(existing)) {
            for (const item of existing) {
                if (item && item.key && Array.isArray(item.locations)) {
                    map.set(item.key, item.locations);
                }
            }
        }
    } catch {
        // Si el JSON anterior está corrupto o vacío, se ignoran las ubicaciones previas
    }

    return map;
}

async function scrapePage(url, isEvent = false, startId = null) {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    const pokemon = [];
    let currentId = startId;
    let eventId = 1;

    $("tr").each((_, row) => {
        const cells = $(row).find("td");
        if (cells.length < 4) return;

        const number = $(cells[0]).text().trim();
        if (!number.startsWith("#")) return;

        let pokopiaId;
        if (isEvent) {
            pokopiaId = EVENT_ID_OFFSET + eventId++;
        } else if (currentId !== null) {
            pokopiaId = currentId++;
        } else {
            pokopiaId = parseInt(number.slice(1), 10);
        }

        const name = $(cells[2]).text().trim();

        const href = $(cells[2]).find("a").attr("href") || "";
        const key = href.split("/").pop().replace(".shtml", "");

        const imgSrc = $(cells[1]).find("img").attr("src") || "";
        const image = imgSrc.split("/").pop().replace(".png", "");

        const specialties = [];
        $(cells[3]).find("u").each((_, specialty) => {
            specialties.push($(specialty).text().trim());
        });

        pokemon.push({
            key,
            pokopiaId,
            image,
            name,
            specialties,
            locations: []
        });
    });

    return pokemon;
}

async function scrapeLocations(pokemonList, previousLocationsMap) {
    for (const p of pokemonList) {
        console.log(`(${p.pokopiaId}) ${p.name}`);

        try {
            const url = `${BASE_URL}/pokemonpokopia/pokedex/${p.key}.shtml`;
            const { data } = await axios.get(url);
            const $ = cheerio.load(data);

            let table = null;
            $("table.dextable").each((_, t) => {
                if ($(t).find("h2").first().text().trim() === "Habitats & Locations") {
                    table = $(t);
                }
            });

            if (!table) {
                console.log("  -> Sin tabla");
                p.locations = [];
                continue;
            }

            const rows = table.find("> tbody > tr");
            const headerRow = rows.eq(1);
            const locationRow = rows.eq(3);
            const rarityRow = rows.eq(4);
            const conditionsRow = rows.eq(5);

            const habitats = headerRow.find("td");
            const locations = [];

            habitats.each((i, td) => {
                const headerCell = $(td);
                const href = headerCell.find("a").attr("href") || "";
                const habitatKey = href.split("/").pop().replace(".shtml", "");

                const zones = [];
                locationRow
                    .find("td")
                    .eq(i)
                    .find("a")
                    .each((_, zone) => {
                        const zoneHref = $(zone).attr("href") || "";
                        zones.push({
                            key: zoneHref.split("/").pop().replace(".shtml", ""),
                            name: $(zone).text().trim()
                        });
                    });

                const rarity = rarityRow
                    .find("td")
                    .eq(i)
                    .text()
                    .replace("Rarity:", "")
                    .replace(/\s+/g, " ")
                    .trim();

                const conditionCell = conditionsRow.find("> td").eq(i);
                const conditionTable = conditionCell.find("table").first();
                const dataRow = conditionTable.find("tr").eq(1);
                const columns = dataRow.find("td");

                const time = splitValues(columns.eq(0).text());
                const weather = splitValues(columns.eq(1).text());

                locations.push({
                    habitat: habitatKey,
                    zones,
                    rarity,
                    time,
                    weather
                });
            });

            p.locations = locations;
            await new Promise((r) => setTimeout(r, 300));
        } catch (err) {
            console.log(`Error con ${p.name}: ${err.message}`);
            if (previousLocationsMap.has(p.key)) {
                p.locations = previousLocationsMap.get(p.key);
                console.log("  -> Conservando ubicaciones anteriores");
            } else {
                p.locations = [];
            }
        }
    }
}

async function scrapePokemon() {
    console.log("Descargando Pokémon...");

    const previousLocationsMap = loadExistingLocationsMap(OUTPUT_PATH);

    const AREA_URLS = [
        NORMAL_URL,
        BASIN_URL
        // Aquí añadirás futuras zonas
    ];

    const pokemon = [];
    let nextId = 1;

    for (const url of AREA_URLS) {
        const areaPokemon = await scrapePage(url, false, nextId);
        pokemon.push(...areaPokemon);
        nextId += areaPokemon.length;
    }

    const eventPokemon = await scrapePage(EVENT_URL, true);
    pokemon.push(...eventPokemon);

    console.log("Descargando localizaciones...");
    await scrapeLocations(pokemon, previousLocationsMap);

    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(pokemon, null, 4), "utf8");

    console.log(`✅ ${pokemon.length} Pokémon guardados en ${OUTPUT_PATH}`);
}

scrapePokemon();