import { Payload, redactFields, redactHeaders } from "./payload";
import APIToolkit from "./index";
import { PubSub } from "@google-cloud/pubsub";
import request from "supertest";
import express, { Request, Response, Router } from "express";
import multer from "multer";
import formidable from "formidable";
import busboy from "busboy";
import axios, { AxiosResponse } from 'axios';

export const APIKEY = process.env["APITOOLKIT_KEY"] || "";
export const EmptyClientMetadata = {
  pubsub_project_id: "pid",
  topic_id: "tid",
  project_id: "00000000-0000-0000-0000-000000000000",
  pubsub_push_service_account: null,
};

describe("Express SDK API Tests", () => {
  it("should post data", async () => {
    const app = express();
    let published = false;
    const redactHeaders = ["Authorization", "X-SECRET"];
    const client = await APIToolkit.NewClient({
      apiKey: APIKEY,
      redactHeaders,
      redactResponseBody: exampleDataRedaction,
      clientMetadata: EmptyClientMetadata,
    });
    client.publishMessage = (payload: Payload) => {
      expect(payload.method).toBe("POST");
      expect(payload.path_params).toMatchObject({ slug: "slug-value" });
      expect(payload.status_code).toBe(200);
      expect(payload.sdk_type).toBe("JsExpress");
      expect(payload.request_headers).toMatchObject({
        "accept-encoding": ["gzip, deflate"],
        connection: ["close"],
        "content-length": ["437"],
        "content-type": ["application/json"],
        "x-api-key": ["past-3"],
      });

      expect(payload.response_headers).toMatchObject({
        "content-type": ["application/json; charset=utf-8"],
        "x-secret": ["[CLIENT_REDACTED]"],
        "x-api-key": ["applicationKey"],
      });

      expect(payload.url_path).toBe("/:slug/test");
      expect(payload.raw_url).toBe("/slug-value/test");
      expect(payload.response_body).toBe(
        Buffer.from(JSON.stringify(exampleDataRedacted)).toString("base64")
      );
      expect(payload.request_body).toBe(
        Buffer.from(JSON.stringify(exampleRequestData)).toString("base64")
      );
      published = true;
    };
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(client.expressMiddleware);
    app.post("/:slug/test", (req: Request, res: Response) => {
      res.setHeader("X-API-KEY", "applicationKey");
      res.header("X-SECRET", "secret value");
      res.json(exampleResponseData);
    });

    const response = await request(app)
      .post("/slug-value/test")
      .set("Content-Type", "application/json")
      .set("X-API-KEY", "past-3")
      .send(exampleRequestData);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(published).toBe(true);
  });

  it("should get data", async () => {
    const app = express();
    let published = false;
    const redactHeaders = ["Authorization", "X-SECRET"];
    const client = await APIToolkit.NewClient({
      apiKey: APIKEY,
      redactHeaders,
      clientMetadata: EmptyClientMetadata,
    });
    client.publishMessage = (payload: Payload) => {
      expect(payload.method).toBe("GET");
      expect(payload.path_params).toMatchObject({ slug: "slug-value" });
      expect(payload.query_params).toMatchObject({ param1: ["abc"], param2: ["123"] });
      expect(payload.status_code).toBe(200);
      expect(payload.sdk_type).toBe("JsExpress");
      expect(payload.url_path).toBe("/:slug/test");
      expect(payload.raw_url).toBe("/slug-value/test?param1=abc&param2=123");
      expect(payload.duration).toBeGreaterThan(500_000_000);
      expect(payload.response_body).toBe(
        Buffer.from(JSON.stringify(exampleRequestData)).toString("base64")
      );
      published = true;
    };

    app.use(client.expressMiddleware);
    app.get("/:slug/test", (req: Request, res: Response) => {
      res.setHeader("X-API-KEY", "applicationKey");
      res.header("X-SECRET", "secret value");
      setTimeout(() => {
        res.json(exampleRequestData);
      }, 500);
    });

    const response = await request(app)
      .get("/slug-value/test?param1=abc&param2=123")
      .set("Content-Type", "application/json")
      .set("X-API-KEY", "past-3")
      .send(exampleRequestData);

    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body)).toBe(JSON.stringify(exampleRequestData));
    expect(published).toBe(true);
  });

  it("should check sub routes", async () => {
    const app = express();
    let published = false;
    const redactHeaders = ["Authorization", "X-SECRET"];
    const client = await APIToolkit.NewClient({
      apiKey: APIKEY,
      redactHeaders,
      clientMetadata: EmptyClientMetadata,
    });
    client.publishMessage = (payload: Payload) => {
      expect(payload.sdk_type).toBe("JsExpress");
      expect(payload.url_path).toBe("/parent/:slug/test");
      expect(payload.raw_url).toBe("/parent/slug-value/test?param1=abc&param2=123");
      published = true;
    };
    app.use(client.expressMiddleware);

    const router = Router();
    router.get("/:slug/test", (req: Request, res: Response) => {
      res.setHeader("X-API-KEY", "applicationKey");
      res.header("X-SECRET", "secret value");
      setTimeout(() => {
        res.json(exampleRequestData);
      }, 500);
    });
    app.use("/parent", router);

    const response = await request(app)
      .get("/parent/slug-value/test?param1=abc&param2=123")
      .send(exampleRequestData);

    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body)).toBe(JSON.stringify(exampleRequestData));
    expect(published).toBe(true);
  });

  it("should check sub sub sub routes", async () => {
    const app = express();
    let published = false;
    const redactHeaders = ["Authorization", "X-SECRET"];
    const client = await APIToolkit.NewClient({
      apiKey: APIKEY,
      redactHeaders,
      clientMetadata: EmptyClientMetadata,
    });
    client.publishMessage = (payload: Payload) => {
      expect(payload.sdk_type).toBe("JsExpress");
      expect(payload.url_path).toBe("/parent/parent2/parent3/:slug/test");
      expect(payload.raw_url).toBe("/parent/parent2/parent3/slug-value/test?param1=abc&param2=123");
      published = true;
    };
    app.use(client.expressMiddleware);

    const router = Router();
    router.get("/:slug/test", (_req: Request, res: Response) => {
      res.setHeader("X-API-KEY", "applicationKey");
      res.header("X-SECRET", "secret value");
      setTimeout(() => {
        res.json(exampleRequestData);
      }, 500);
    });

    const router3 = Router();
    router3.use("/parent3", router);

    const router2 = Router();
    router2.use("/parent2", router3);
    app.use("/parent", router2);
    const response = await request(app)
      .get("/parent/parent2/parent3/slug-value/test?param1=abc&param2=123")
      .send(exampleRequestData);

    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body)).toBe(JSON.stringify(exampleRequestData));
    expect(published).toBe(true);
  });

  it("should ignore path for endpoins with OPTION", async () => {
    const app = express();
    let published = false;
    const client = await APIToolkit.NewClient({
      apiKey: APIKEY,
      clientMetadata: EmptyClientMetadata,
    });
    client.publishMessage = (payload: Payload) => {
      expect(payload.method).toBe("OPTIONS");
      expect(payload.status_code).toBe(200);
      expect(payload.sdk_type).toBe("JsExpress");
      expect(payload.url_path).toBe("");
      published = true;
    };

    app.use(client.expressMiddleware);
    app.use((req, res, next) => {
      if (req.method === "OPTIONS") {
        res.json({ message: "OPTIONS ignored" });
        return;
      }
      next();
    });
    app.options("/:slug/test", (req: Request, res: Response) => {
      res.setHeader("X-API-KEY", "applicationKey");
      res.header("X-SECRET", "secret value");
      res.json({ message: "OPTIONS not ignore" });
    });

    const response = await request(app).options("/slug-value/test");
    expect(response.status).toBe(200);
    expect(response.body.message).toBe("OPTIONS ignored");
    expect(published).toBe(true);
  });
});

describe("File Upload Endpoint", () => {
  jest.setTimeout(10_000);
  it("should upload files (multer)", async () => {
    const app = express();
    let published = false;
    const client = await APIToolkit.NewClient({
      apiKey: APIKEY,
      clientMetadata: EmptyClientMetadata,
    });
    client.publishMessage = (payload: Payload) => {
      expect(payload.method).toBe("POST");
      expect(payload.status_code).toBe(200);
      expect(payload.request_body).toBe(
        Buffer.from(
          JSON.stringify({
            name: "John",
            file_one: ["[image/png_FILE]"],
            file_two: ["[image/png_FILE]"],
          })
        ).toString("base64")
      );
      expect(payload.response_body).toBe(
        Buffer.from(JSON.stringify({ message: "File upload successful." })).toString("base64")
      );
      published = true;
    };

    app.use(client.expressMiddleware);
    const storage = multer.memoryStorage();
    const upload = multer({ storage });

    app.post(
      "/upload-multer",
      upload.fields([{ name: "file_one" }, { name: "file_two" }]),
      (req, res) => {
        expect(req.body).toMatchObject({ name: "John" });
        expect(req.files).toMatchObject({
          file_one: [
            {
              fieldname: "file_one",
              originalname: "file_one.png",
              encoding: "7bit",
              mimetype: "image/png",
              size: 1538,
            },
          ],
          file_two: [
            {
              fieldname: "file_two",
              originalname: "file_two.png",
              encoding: "7bit",
              mimetype: "image/png",
              size: 330532,
            },
          ],
        });
        res.status(200).json({ message: "File upload successful." });
      }
    );
    const response = await request(app)
      .post("/upload-multer")
      .field("name", "John")
      .attach("file_one", "./file_one.png")
      .attach("file_two", "./file_two.png");
    expect(response.status).toBe(200);
    expect(response.body.message).toBe("File upload successful.");
    expect(published).toBe(true);
  });

  it("should upload files (formidable)", async () => {
    const app = express();
    let published = false;
    const client = await APIToolkit.NewClient({
      apiKey: APIKEY,
      clientMetadata: EmptyClientMetadata,
    });
    client.publishMessage = (payload: Payload) => {
      expect(payload.method).toBe("POST");
      expect(payload.status_code).toBe(200);
      expect(payload.sdk_type).toBe("JsExpress");
      expect(payload.response_body).toBe(
        Buffer.from(JSON.stringify({ message: "Uploaded successfully" })).toString("base64")
      );
      published = true;
    };
    app.use(client.expressMiddleware);
    app.post("/upload-formidable", (req, res, next) => {
      const form = formidable({});
      form.parse(req, (err, fields, files) => {
        expect(fields).toMatchObject({ name: ["John"] });
        expect(files).toMatchObject({
          file_one: [
            {
              originalFilename: "file_one.png",
              mimetype: "image/png",
              size: 1538,
            },
          ],
          file_two: [
            {
              originalFilename: "file_two.png",
              mimetype: "image/png",
              size: 330532,
            },
          ],
        });
        res.json({ message: "Uploaded successfully" });
      });
    });
    const response = await request(app)
      .post("/upload-formidable")
      .field("name", "John")
      .attach("file_one", "./file_one.png")
      .attach("file_two", "./file_two.png");
    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Uploaded successfully");
    expect(published).toBe(true);
  });

  it("should upload files (busboy)", async () => {
    const app = express();
    let published = false;
    const client = await APIToolkit.NewClient({
      apiKey: APIKEY,
      clientMetadata: EmptyClientMetadata,
    });
    client.publishMessage = (payload: Payload) => {
      expect(payload.method).toBe("POST");
      expect(payload.status_code).toBe(200);
      expect(payload.sdk_type).toBe("JsExpress");
      expect(payload.response_body).toBe(
        Buffer.from(JSON.stringify({ message: "Uploaded successfully" })).toString("base64")
      );
      published = true;
    };
    app.use(client.expressMiddleware);
    app.post("/upload-busboy", (req, res) => {
      let recieved = 0;
      const bb = busboy({ headers: req.headers });
      bb.on("file", (name, file, info) => {
        file.resume();
        recieved++;
        if (name === "file_one") {
          expect(info).toMatchObject({
            filename: "file_one.png",
            encoding: "7bit",
            mimeType: "image/png",
          });
        } else {
          expect(info).toMatchObject({
            filename: "file_two.png",
            encoding: "7bit",
            mimeType: "image/png",
          });
        }
      });
      bb.on("field", (name, value) => {
        expect(name).toBe("name");
        expect(value).toBe("John");
      });
      bb.on("finish", () => {
        expect(recieved).toBe(2);
        res.json({ message: "Uploaded successfully" });
      });
      req.pipe(bb);
      return;
    });

    const response = await request(app)
      .post("/upload-busboy")
      .field("name", "John")
      .attach("file_one", "./file_one.png")
      .attach("file_two", "./file_two.png");

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Uploaded successfully");
    expect(published).toBe(true);
  });
});

describe("testing headers and jsonpath redaction", () => {
  let myClassInstance: APIToolkit;

  beforeEach(() => {
    const pubsub = new PubSub({
      projectId: "pubsub_project_id",
    });
    myClassInstance = new APIToolkit(pubsub, "topic_id", "project_id", { apiKey: "", debug: true });
  });

  it("should redact headers correctly", () => {
    const headers: Map<string, string[]> = new Map([
      ["Authorization", ["token"]],
      ["User-Agent", ["MyApp"]],
      ["Content-Type", ["text/json"]],
    ]);

    const headersToRedact = ["Authorization", "content-type"];

    const redactedHeaders = redactHeaders(headers, headersToRedact);

    expect(redactedHeaders["Authorization"]).toEqual(["[CLIENT_REDACTED]"]);
    expect(redactedHeaders["Content-Type"]).toEqual(["[CLIENT_REDACTED]"]);
    expect(redactedHeaders["User-Agent"]).toEqual(["MyApp"]);
  });

  it("should redact fields correctly", () => {
    const body =
      '{"user": {"name": "John", "email": "john@example.com", "books": [{"title": "Book 1", "author": "Author 1"},{"title": "Book 2", "author": "Author 2"}]}}';
    const fieldsToRedact = ["$.user.email", "user.books[*].author"];

    const redactedBody = redactFields(body, fieldsToRedact);

    expect(redactedBody).toContain('"email":"[CLIENT_REDACTED]"');
    expect(redactedBody).toContain(
      '{"title":"Book 1","author":"[CLIENT_REDACTED]"},{"title":"Book 2","author":"[CLIENT_REDACTED]"}'
    );
    expect(redactedBody).toContain('"name":"John"');
  });
});

const exampleResponseData = {
  status: "success",
  data: {
    message: "hello world",
    account_data: {
      batch_number: 12345,
      account_id: "123456789",
      account_name: "test account",
      account_type: "test",
      account_status: "active",
      account_balance: "100.00",
      account_currency: "USD",
      account_created_at: "2020-01-01T00:00:00Z",
      account_updated_at: "2020-01-01T00:00:00Z",
      account_deleted_at: "2020-01-01T00:00:00Z",
      possible_account_types: ["test", "staging", "production"],
      possible_account_types2: ["test", "staging", "production"],
    },
  },
};

const exampleDataRedaction = [
  "$.status",
  "$.data.account_data.account_type",
  "$.data.account_data.possible_account_types",
  "$.data.account_data.possible_account_types2[*]",
  "$.non_existent",
];

const exampleDataRedacted = {
  status: "[CLIENT_REDACTED]",
  data: {
    message: "hello world",
    account_data: {
      batch_number: 12345,
      account_id: "123456789",
      account_name: "test account",
      account_type: "[CLIENT_REDACTED]",
      account_status: "active",
      account_balance: "100.00",
      account_currency: "USD",
      account_created_at: "2020-01-01T00:00:00Z",
      account_updated_at: "2020-01-01T00:00:00Z",
      account_deleted_at: "2020-01-01T00:00:00Z",
      possible_account_types: "[CLIENT_REDACTED]",
      possible_account_types2: ["[CLIENT_REDACTED]", "[CLIENT_REDACTED]", "[CLIENT_REDACTED]"],
    },
  },
};

const exampleRequestData = {
  status: "request",
  send: {
    message: "hello world",
    account_data: [
      {
        batch_number: 12345,
        account_id: "123456789",
        account_name: "test account",
        account_type: "test",
        account_status: "active",
        account_balance: "100.00",
        account_currency: "USD",
        account_created_at: "2020-01-01T00:00:00Z",
        account_updated_at: "2020-01-01T00:00:00Z",
        account_deleted_at: "2020-01-01T00:00:00Z",
        possible_account_types: ["test", "staging", "production"],
      },
    ],
  },
};
