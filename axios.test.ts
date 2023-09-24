import { Payload } from "./index";
import {APIKEY, EmptyClientMetadata} from "./index.test";
import APIToolkit from "./index";
import request from "supertest";
import express, { Request, Response, Router } from "express";
import axios, { AxiosResponse } from 'axios';
import {observeAxios} from './axios';


describe("Axios Interceptors", () => {
  let server: any;
  let baseURL: string;
  const app = express();

  beforeEach(done => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseURL = `http://localhost:${port}`;
      done();
    });
  });

  afterEach(done => {
    server.close(done);
  });

  it("should intercept axios", async () => {
    let published = false;
    let pingCalled = true;
    const redactHeaders = ["Authorization", "X-SECRET"];
    const client = await APIToolkit.NewClient({
      apiKey: APIKEY,
      redactHeaders,
      clientMetadata: EmptyClientMetadata,
    });
    client.publishMessage = (payload: Payload) => {
      published = true
      console.dir(payload)
    };

    app.use(client.expressMiddleware);
    app.get("/ping", (req: Request, res: Response) => {
      pingCalled = true
      res.json({'ping':'pong'});
    });
    app.get("/:slug/test", async (req: Request, res: Response) => {
        const response: AxiosResponse = await observeAxios(axios).get(`${baseURL}/ping`);
        res.json(response.data);
    });

    const response = await request(app)
      .get("/slug-value/test?param1=abc&param2=123")
      .set("Content-Type", "application/json")
      .set("X-API-KEY", "past-3")
      .send({"data":"resp"});

    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body)).toBe(JSON.stringify({"ping":"pong"}));
    expect(published).toBe(true)
    expect(pingCalled).toBe(true)
  });
})
