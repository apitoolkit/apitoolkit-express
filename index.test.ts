import { Config, Payload } from './index';
import APIToolkit from './index';
import { PubSub } from '@google-cloud/pubsub';
import request from 'supertest';
import express, { Request, Response } from 'express';


describe('Express SDK API Tests', () => {
  it('should post data', async () => {
    const app = express();
    let published = false
    const redactHeaders = ['Authorization', "X-SECRET"]
    const client = await APIToolkit.NewClient({ apiKey: "<API_KEY>", redactHeaders, redactResponseBody: exampleDataRedaction })
    client.publishMessage = (payload: Payload) => {
      expect(payload.method).toBe("POST")
      expect(payload.path_params).toMatchObject({ slug: "slug-value" })
      expect(payload.status_code).toBe(200)
      expect(payload.sdk_type).toBe("JsExpress")
      expect(Object.fromEntries(payload.request_headers)).toMatchObject({
        "accept-encoding": [
          "gzip, deflate",
        ],
        "connection": [
          "close",
        ],
        "content-length": [
          "437",
        ],
        "content-type": [
          "application/json",
        ],
        "x-api-key": [
          "past-3",
        ],
      })

      expect(Object.fromEntries(payload.response_headers)).toMatchObject({
        "content-type": [
          "application/json; charset=utf-8",
        ],
        "x-secret": ["[CLIENT_REDACTED]"],
        "x-api-key": ["applicationKey"]
      })

      expect(payload.url_path).toBe("/:slug/test")
      expect(payload.raw_url).toBe("/slug-value/test")
      expect(payload.response_body).toBe(Buffer.from(JSON.stringify(exampleDataRedacted)).toString('base64'))
      expect(payload.request_body).toBe(Buffer.from(JSON.stringify(exampleRequestData)).toString('base64'))
      published = true
    }
    app.use(client.expressMiddleware)
    app.post('/:slug/test', (req: Request, res: Response) => {
      res.setHeader("X-API-KEY", "applicationKey")
      res.header("X-SECRET", "secret value")
      res.json(exampleResponseData);
    });

    const response = await request(app)
      .post('/slug-value/test')
      .set('Content-Type', 'application/json')
      .set('X-API-KEY', 'past-3')
      .send(exampleRequestData);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(published).toBe(true)
  });


  it('should get data', async () => {
    const app = express();
    let published = false
    const redactHeaders = ['Authorization', "X-SECRET"]
    const client = await APIToolkit.NewClient({ apiKey: "<API_KEY>", redactHeaders })
    client.publishMessage = (payload: Payload) => {
      expect(payload.method).toBe("GET")
      expect(payload.path_params).toMatchObject({ slug: "slug-value" })
      expect(payload.query_params).toMatchObject({ param1: ["abc"], param2: ["123"] })
      expect(payload.status_code).toBe(200)
      expect(payload.sdk_type).toBe("JsExpress")
      expect(payload.url_path).toBe("/:slug/test")
      expect(payload.raw_url).toBe("/slug-value/test?param1=abc&param2=123")
      expect(payload.duration).toBeGreaterThan(500_000_000)
      expect(payload.response_body).toBe(Buffer.from(JSON.stringify(exampleRequestData)).toString('base64'))
      published = true
    }

    app.use(client.expressMiddleware)
    app.get('/:slug/test', (req: Request, res: Response) => {
      res.setHeader("X-API-KEY", "applicationKey")
      res.header("X-SECRET", "secret value")
      setTimeout(() => {
        res.json(exampleRequestData);
      }, 500);
    });

    const response = await request(app)
      .get('/slug-value/test?param1=abc&param2=123')
      .set('Content-Type', 'application/json')
      .set('X-API-KEY', 'past-3')
      .send(exampleRequestData);

    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body)).toBe(JSON.stringify(exampleRequestData));
    expect(published).toBe(true)
  });
});



describe('testing headers and jsonpath redaction', () => {
  let myClassInstance: APIToolkit;

  beforeEach(() => {
    const pubsub = new PubSub({
      projectId: "pubsub_project_id"
    });
    myClassInstance = new APIToolkit(pubsub, "topic_id", "project_id", [], [], [], true);
  });

  it('should redact headers correctly', () => {
    const headers: Map<string, string[]> = new Map([
      ['Authorization', ["token"]],
      ["User-Agent", ["MyApp"]],
      ["Content-Type", ["text/json"]]
    ]);

    const headersToRedact = ['Authorization', 'content-type'];

    const redactedHeaders = myClassInstance['redactHeaders'](headers, headersToRedact);

    expect(redactedHeaders.get('Authorization')).toEqual(['[CLIENT_REDACTED]']);
    expect(redactedHeaders.get('Content-Type')).toEqual(['[CLIENT_REDACTED]']);
    expect(redactedHeaders.get('User-Agent')).toEqual(['MyApp']);
  });

  it('should redact fields correctly', () => {
    const body = '{"user": {"name": "John", "email": "john@example.com", "books": [{"title": "Book 1", "author": "Author 1"},{"title": "Book 2", "author": "Author 2"}]}}';
    const fieldsToRedact = ['$.user.email', 'user.books[*].author'];

    const redactedBody = myClassInstance['redactFields'](body, fieldsToRedact);

    expect(redactedBody).toContain('"email":"[CLIENT_REDACTED]"');
    expect(redactedBody).toContain('{"title":"Book 1","author":"[CLIENT_REDACTED]"},{"title":"Book 2","author":"[CLIENT_REDACTED]"}')
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
  "$.status", "$.data.account_data.account_type",
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
    account_data: [{
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
    }],
  },
};


