const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");

const NORMAL_URL = "https://www.serebii.net/pokemonpokopia/availablepokemon.shtml";
const BASIN_URL = "https://www.serebii.net/pokemonpokopia/basinpokedex.shtml";
const EVENT_URL = "https://www.serebii.net/pokemonpokopia/eventpokedex.shtml";

const EVENT_ID_OFFSET = 10000;

const pokemon = require("../data/pokemon.json");

const BASE_URL = "https://www.serebii.net";

function splitValues(text) {
    const value = text.trim().replace(/\s+/g, "");
    if (!value || value === "-") {
        return [];
    }
    return value.split(/(?=[A-Z])/);
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

        const key = $(cells[2])
            .find("a")
            .attr("href")
            .split("/")
            .pop()
            .replace(".shtml", "");

        const image = $(cells[1])
            .find("img")
            .attr("src")
            .split("/")
            .pop()
            .replace(".png", "");

        const specialties = [];

        $(cells[3]).find("u").each((_, specialty) => {
            specialties.push($(specialty).text().trim());
        });

        pokemon.push({
            key,
            pokopiaId,
            image,
            name,
            specialties
        });

    });

    return pokemon;

}

async function scrapePokemon() {

    console.log("Descargando Pokémon...");

    const AREA_URLS = [
        NORMAL_URL,
        BASIN_URL
        // Aquí añadirás futuras zonas
    ];

    let pokemon = [];

    let nextId = 1;

    for (const url of AREA_URLS) {

        const areaPokemon = await scrapePage(
            url,
            false,
            nextId
        );

        pokemon.push(...areaPokemon);

        nextId += areaPokemon.length;

    }

    const eventPokemon = await scrapePage(
        EVENT_URL,
        true
    );

    pokemon.push(...eventPokemon);

    console.log("Descargando localizaciones...");

    await scrapeLocations(pokemon);

    fs.mkdirSync("data", { recursive: true });

    fs.writeFileSync(
        "data/pokemon.json",
        JSON.stringify(pokemon, null, 4),
        "utf8"
    );

    console.log(`✅ ${pokemon.length} Pokémon guardados`);

}

async function scrapeLocations(pokemon) {

    for (const p of pokemon) {

        console.log(`(${p.pokopiaId}) ${p.name}`);

        p.locations = [];

        try {
        
            const url =`${BASE_URL}/pokemonpokopia/pokedex/${p.key}.shtml`;

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

                continue;

            }

            const rows = table.find("> tbody > tr");

            const headerRow = rows.eq(1);
            const locationRow = rows.eq(3);
            const rarityRow = rows.eq(4);
            const conditionsRow = rows.eq(5);

            const habitats = headerRow.find("td");

            habitats.each((i, td) => {

                const headerCell = $(td);

                const href = headerCell.find("a").attr("href");

                const habitatKey = href
                    .split("/")
                    .pop()
                    .replace(".shtml", "");

                const zones = [];

                locationRow
                    .find("td")
                    .eq(i)
                    .find("a")
                    .each((_, zone) => {

                        const zoneHref = $(zone).attr("href");

                        zones.push({

                            key: zoneHref
                                .split("/")
                                .pop()
                                .replace(".shtml", ""),

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

                const conditionCell = conditionsRow
                    .find("> td")
                    .eq(i);

                const conditionTable = conditionCell
                    .find("table")
                    .first();

                const dataRow = conditionTable
                    .find("tr")
                    .eq(1);

                const columns = dataRow.find("td");

                const time = splitValues(
                    columns.eq(0).text()
                );

                const weather = splitValues(
                    columns.eq(1).text()
                );

                p.locations.push({

                    habitat: habitatKey,

                    zones,

                    rarity,

                    time,

                    weather

                });

            });

            await new Promise(r => setTimeout(r, 300));

        } catch (err) {

            console.log(`Error con ${p.name}`);

            console.log(err.message);

        }

    }

}

scrapePokemon();