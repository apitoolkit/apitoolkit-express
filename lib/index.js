"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const apitoolkit_1 = __importDefault(require("./apitoolkit"));
const app = (0, express_1.default)();
const config = {
    apiKey: "kPNLecYZO3szyYAfgqZsT2hJ9GKSStaeurruhrlboTBR9dzC",
    serviceName: "express-example",
    serviceVersion: "1.0.0",
    debug: true,
    otelInstrumentated: false,
};
const apitoolkit = apitoolkit_1.default.NewClient(config);
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use(apitoolkit.expressMiddleware);
app.get("/", (req, res) => {
    res.send("Hello World!");
});
app.get("/hello", (req, res) => {
    res.send("Hello World!");
});
app.post("/user/:name", (req, res) => {
    res.send("Hello " + req.params.name);
});
app.listen(3000, () => {
    console.log("Server running on port 3000");
});
