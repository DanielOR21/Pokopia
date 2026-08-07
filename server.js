const express = require("express");
const path = require("path");

const app = express();

app.use(express.static(path.join(__dirname, "public")));

app.use(
    "/data",
    express.static(path.join(__dirname, "data"))
);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

    console.log(
        `Servidor iniciado en http://localhost:${PORT}`
    );

});