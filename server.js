const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();

app.use(express.static(path.join(__dirname, "public")));
app.use("/data", express.static(path.join(__dirname, "data")));

app.get("/userdata", (req, res) => {

    const file = path.join(__dirname, "data", "userData.json");

    const data = fs.readFileSync(file, "utf8");

    res.json(JSON.parse(data));

});

app.post("/userdata", express.json(), (req, res) => {

    const file = path.join(__dirname, "data", "userData.json");

    fs.writeFileSync(
        file,
        JSON.stringify(req.body, null, 4),
        "utf8"
    );

    res.json({ success: true });

});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

    console.log(`Servidor iniciado en http://localhost:${PORT}`);

});