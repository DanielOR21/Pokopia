const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");

const URL = "https://www.serebii.net/pokemonpokopia/habitats.shtml";
const BASE = "https://www.serebii.net";

async function scrapeHabitats() {

    try {

        console.log("Descargando hábitats...");

        const { data } = await axios.get(URL);
        const $ = cheerio.load(data);

        const habitats = [];

        $("tr").each((_, row) => {

            const cells = $(row).find("td");

            if (cells.length < 3) return;

            const number = $(cells[0]).text().trim();

            if (!number.startsWith("#")) return;

            const id = parseInt(number.slice(1), 10);

            const image = $(cells[1])
                .find("img")
                .attr("src")
                .split("/")
                .pop()
                .replace(".png", "");

            const link = $(cells[2])
                .find("a")
                .attr("href");

            const key = link
                .split("/")
                .pop()
                .replace(".shtml", "");

            const name = $(cells[2])
                .text()
                .replace(/\s+/g, " ")
                .trim();

            habitats.push({
                id,
                key,
                image,
                name,
                materials: []
            });

        });

        console.log("Descargando materiales...");

        for (const habitat of habitats) {

            const { data } = await axios.get(
                `${BASE}/pokemonpokopia/habitatdex/${habitat.key}.shtml`
            );

            const $$ = cheerio.load(data);

            const table = $$("table.dextable").first();

            table.find("tr").slice(1).each((_, row) => {

                const cols = $$(row).find("td");

                if (cols.length !== 3) return;

                const img = cols.eq(0).find("img");

                const href = cols.eq(0).find("a").attr("href");

                let key;

                if (href) {

                    key = href
                        .split("/")
                        .pop()
                        .replace(".shtml", "");

                } else {

                    key = img
                        .attr("src")
                        .split("/")
                        .pop()
                        .replace(".png", "");

                }

                habitat.materials.push({

                    key,

                    name: cols.eq(1)
                        .text()
                        .replace(/\s+/g, " ")
                        .trim(),

                    quantity: parseInt(cols.eq(2).text().trim(), 10)

                });

            });

            console.log(
                `${habitat.name}: ${habitat.materials.length} materiales`
            );

        }

        fs.mkdirSync("data", { recursive: true });

        fs.writeFileSync(
            "data/habitats.json",
            JSON.stringify(habitats, null, 4),
            "utf8"
        );

        console.log(`✅ Se han guardado ${habitats.length} hábitats.`);

    } catch (error) {

        console.error(error);

    }

}

scrapeHabitats();