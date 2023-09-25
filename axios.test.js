"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_test_1 = require("./index.test");
const index_1 = __importStar(require("./index"));
const supertest_1 = __importDefault(require("supertest"));
const express_1 = __importDefault(require("express"));
const axios_1 = __importDefault(require("axios"));
const axios_2 = require("./axios");
describe("Axios Interceptors", () => {
    let server;
    let baseURL;
    const app = (0, express_1.default)();
    beforeEach((done) => {
        server = app.listen(0, () => {
            const port = server.address().port;
            baseURL = `http://localhost:${port}`;
            done();
        });
    });
    afterEach((done) => {
        server.close(done);
    });
    it("should intercept axios", async () => {
        return;
        let published = false;
        let pingCalled = true;
        const redactHeadersVar = ["Authorization", "X-SECRET"];
        const client = await index_1.default.NewClient({
            apiKey: index_test_1.APIKEY,
            redactHeaders: redactHeadersVar,
            clientMetadata: index_test_1.EmptyClientMetadata,
        });
        client.publishMessage = (payload) => {
            published = true;
            console.dir(payload);
        };
        app.use(client.expressMiddleware);
        app.get("/ping", (req, res) => {
            pingCalled = true;
            res.json({ ping: "pong" });
        });
        app.get("/:slug/test", async (req, res) => {
            const response = await (0, axios_2.observeAxios)(axios_1.default).get(`${baseURL}/ping`);
            res.json(response.data);
        });
        const response = await (0, supertest_1.default)(app)
            .get("/slug-value/test?param1=abc&param2=123")
            .set("Content-Type", "application/json")
            .set("X-API-KEY", "past-3")
            .send({ data: "resp" });
        expect(response.status).toBe(200);
        expect(JSON.stringify(response.body)).toBe(JSON.stringify({ ping: "pong" }));
        expect(published).toBe(true);
        expect(pingCalled).toBe(true);
    });
    it("should intercept axios via responseError", async () => {
        let published = false;
        let pingCalled = true;
        const redactHeadersVar = ["Authorization", "X-SECRET"];
        const client = await index_1.default.NewClient({
            apiKey: index_test_1.APIKEY,
            redactHeaders: redactHeadersVar,
            clientMetadata: index_test_1.EmptyClientMetadata,
        });
        client.publishMessage = (payload) => {
            published = true;
            console.dir(payload);
        };
        app.use(client.expressMiddleware);
        app.get("/ping", (req, res) => {
            pingCalled = true;
            res.json({ ping: "pong" });
        });
        app.get("/:slug/test", async (req, res) => {
            try {
                const response = await (0, axios_2.observeAxios)(axios_1.default, '/test/{username}', undefined, undefined, undefined).get(`${baseURL}/pingxwrong`);
                res.json(response.data);
            }
            catch (err) {
                (0, index_1.ReportError)(err);
                res.json({ "hello": "error" });
            }
        });
        const response = await (0, supertest_1.default)(app)
            .get("/slug-value/test?param1=abc&param2=123")
            .set("Content-Type", "application/json")
            .set("X-API-KEY", "past-3")
            .send({ data: "resp" });
        expect(response.status).toBe(200);
        expect(JSON.stringify(response.body)).toBe(JSON.stringify({ hello: "error" }));
        // expect(published).toBe(true)
        // expect(pingCalled).toBe(true)
    });
});
