const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");

const pokemon = require("../data/pokemon.json");

const BASE_URL = "https://www.serebii.net";

function splitValues(text) {
    const value = text.trim().replace(/\s+/g, "");
    if (!value || value === "-") {
        return [];
    }
    return value.split(/(?=[A-Z])/);
}

async function scrapePokemonLocations() {

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

                const columns = conditionsRow
                    .find("td")
                    .eq(i)
                    .find("table tr")
                    .eq(1)
                    .find("td");

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

    fs.writeFileSync(
        "./data/pokemon.json",
        JSON.stringify(pokemon, null, 4),
        "utf8"
    );

    console.log("\n✅ pokemon.json actualizado");

}

scrapePokemonLocations();