import fetch from "node-fetch";
import { PubSub, Topic } from "@google-cloud/pubsub";
import { NextFunction, Request, Response } from "express";
import { AsyncLocalStorage } from "async_hooks";
import jsonpath from "jsonpath";

export type Config = {
  apiKey: string;
  rootURL?: string;
  debug?: boolean;
  redactHeaders?: string[];
  redactRequestBody?: string[];
  redactResponseBody?: string[];
  clientMetadata?: ClientMetadata;
};

type ClientMetadata = {
  project_id: string;
  pubsub_project_id: string;
  topic_id: string;
  pubsub_push_service_account: any;
};

export type Payload = {
  duration: number;
  host: string;
  method: string;
  path_params: Object;
  project_id: string;
  proto_major: number;
  proto_minor: number;
  query_params: Object;
  raw_url: string;
  referer: string;
  request_body: string;
  request_headers: Map<string, string[]>;
  response_body: string;
  response_headers: Map<string, string[]>;
  sdk_type: string;
  status_code: number;
  timestamp: string;
  url_path: string;
};

export default class APIToolkit {
  #topic: string;
  #pubsub: PubSub | undefined;
  #project_id: string;
  #redactHeaders: string[];
  #redactRequestBody: string[];
  #redactResponseBody: string[];
  #debug: boolean;
  publishMessage: (payload: Payload) => void;

  private asyncLocalStorage = new AsyncLocalStorage<Map<string, any>>();

  constructor(
    pubsub: PubSub | undefined,
    topic: string,
    project_id: string,
    redactHeaders: string[],
    redactReqBody: string[],
    redactRespBody: string[],
    debug: boolean
  ) {
    this.#topic = topic;
    this.#pubsub = pubsub;
    this.#project_id = project_id;
    this.#redactHeaders = redactHeaders;
    this.#redactRequestBody = redactReqBody;
    this.#redactResponseBody = redactRespBody;
    this.#debug = debug;
    this.publishMessage = (payload: Payload) => {
      const callback = (err: any, messageId: any) => {
        if (this.#debug) {
          console.log(
            "APIToolkit: pubsub publish callback called; messageId: ",
            messageId,
            " error ",
            err
          );
          if (err) {
            console.log("APIToolkit: error publishing message to pubsub");
            console.error(err);
          }
        }
      };
      if (this.#pubsub) {
        this.#pubsub.topic(this.#topic).publishMessage({ json: payload }, callback);
      }
    };
    this.expressMiddleware = this.expressMiddleware.bind(this);
  }

  static async NewClient({
    apiKey,
    rootURL = "https://app.apitoolkit.io",
    redactHeaders = [],
    redactRequestBody = [],
    redactResponseBody = [],
    debug = false,
    clientMetadata,
  }: Config) {
    var pubsubClient;
    if (clientMetadata == null || apiKey != "") {
      clientMetadata = await this.getClientMetadata(rootURL, apiKey);
      pubsubClient = new PubSub({
        projectId: clientMetadata.pubsub_project_id,
        authClient: new PubSub().auth.fromJSON(clientMetadata.pubsub_push_service_account),
      });
    }

    const { pubsub_project_id, topic_id, project_id, pubsub_push_service_account } = clientMetadata;

    if (debug) {
      console.log("apitoolkit:  initialized successfully");
      console.dir(pubsubClient);
    }

    return new APIToolkit(
      pubsubClient,
      topic_id,
      project_id,
      redactHeaders,
      redactRequestBody,
      redactResponseBody,
      debug
    );
  }

  static async getClientMetadata(rootURL: string, apiKey: string) {
    const resp = await fetch(rootURL + "/api/client_metadata", {
      method: "GET",
      headers: {
        Authorization: "Bearer " + apiKey,
        Accept: "application/json",
      },
    });
    if (!resp.ok) throw new Error(`Error getting apitoolkit client_metadata ${resp.status}`);

    return (await resp.json()) as ClientMetadata;
  }

  public getStore() {
    return this.asyncLocalStorage.getStore();
  }

  // public async expressMiddleware(req: Request, res: Response, next: NextFunction) {
  //   this.asyncLocalStorage.run(new Map(), () => {
  //     if (this.#debug) {
  //       console.log("APIToolkit: expressMiddleware called");
  //     }

  //     const start_time = process.hrtime.bigint();
  //     let respBody: any = null;

  //     const oldSend = res.send;
  //     res.send = (val) => {
  //       respBody = val;
  //       return oldSend.apply(res, [val]);
  //     };

  //     const onRespFinished = (topic: Topic | undefined, req: Request, res: Response) => (err: any) => {
  //       res.removeListener("close", onRespFinished(topic, req, res));
  //       res.removeListener("error", onRespFinished(topic, req, res));
  //       res.removeListener("finish", onRespFinished(topic, req, res));

  //       let reqBody = "";
  //       if (req.body) {
  //         try {
  //           if (req.is("multipart/form-data")) {
  //             if (req.file) {
  //               req.body[req.file.fieldname] = `[${req.file.mimetype}_FILE]`;
  //             } else if (req.files) {
  //               if (!Array.isArray(req.files)) {
  //                 for (const file in req.files) {
  //                   req.body[file] = (req.files[file] as any).map(
  //                     (f: any) => `[${f.mimetype}_FILE]`
  //                   );
  //                 }
  //               } else {
  //                 for (const file of req.files) {
  //                   req.body[file.fieldname] = `[${file.mimetype}_FILE]`;
  //                 }
  //               }
  //             }
  //           }
  //           reqBody = JSON.stringify(req.body);
  //         } catch (error) {
  //           reqBody = String(req.body);
  //         }
  //       }
  //       const reqObjEntries: Array<[string, string[]]> = Object.entries(req.headers).map(
  //         ([k, v]: [string, any]): [string, string[]] => [k, Array.isArray(v) ? v : [v]]
  //       );
  //       const reqHeaders = new Map<string, string[]>(reqObjEntries);

  //       const resObjEntries: Array<[string, string[]]> = Object.entries(res.getHeaders()).map(
  //         ([k, v]: [string, any]): [string, string[]] => [k, Array.isArray(v) ? v : [v]]
  //       );
  //       const resHeaders = new Map<string, string[]>(resObjEntries);

  //       const queryObjEntries = Object.entries(req.query).map(([k, v]) => {
  //         if (typeof v === "string") return [k, [v]];
  //         return [k, v];
  //       });
  //       const queryParams = Object.fromEntries(queryObjEntries);
  //       const pathParams = req.params ?? {};
  //       let urlPath = req.route?.path ?? "";
  //       let rawURL = req.originalUrl;
  //       if (req.baseUrl && req.baseUrl != "") {
  //         urlPath = req.baseUrl + urlPath;
  //       }

  //       const payload: Payload = {
  //         duration: Number(process.hrtime.bigint() - start_time),
  //         host: req.hostname,
  //         method: req.method,
  //         path_params: pathParams,
  //         project_id: this.#project_id,
  //         proto_minor: 1,
  //         proto_major: 1,
  //         query_params: queryParams,
  //         raw_url: rawURL,
  //         referer: req.headers.referer ?? "",
  //         request_body: Buffer.from(this.redactFields(reqBody, this.#redactRequestBody)).toString(
  //           "base64"
  //         ),
  //         request_headers: this.redactHeaders(reqHeaders, this.#redactHeaders),
  //         response_body: Buffer.from(
  //           this.redactFields(respBody, this.#redactResponseBody)
  //         ).toString("base64"),
  //         response_headers: this.redactHeaders(resHeaders, this.#redactHeaders),
  //         sdk_type: "JsExpress",
  //         status_code: res.statusCode,
  //         timestamp: new Date().toISOString(),
  //         url_path: urlPath,
  //       };
  //       if (this.#debug) {
  //         console.log("APIToolkit: publish prepared payload ");
  //         console.dir(payload);
  //       }
  //       this.publishMessage(payload);
  //     };

  //     const onRespFinishedCB = onRespFinished(this.#pubsub?.topic(this.#topic), req, res);
  //     res.on("finish", onRespFinishedCB);
  //     res.on("error", onRespFinishedCB);
  //     // res.on('close', onRespFinishedCB)

  //     next();
  //   });
  // }

  public async expressMiddleware(req: Request, res: Response, next: NextFunction) {
    this.asyncLocalStorage.run(new Map(), () => {
      if (this.#debug) {
        console.log("APIToolkit: expressMiddleware called");
      }

      const start_time = process.hrtime.bigint();
      const respBody = this.modifyResSend(res);
      const onRespFinishedCB = this.createOnRespFinishedCallback(start_time, req, res, respBody);

      this.attachResponseListeners(res, onRespFinishedCB);

      next();
    });
  }
  private createOnRespFinishedCallback(start_time: bigint, req: Request, res: Response, respBody: any) {
    return (err: any) => {
      // The logic for handling the response and publishing the message, e.g.:
      
      const payload: Payload = this.createPayload(start_time, req, res, respBody);
      
      if (this.#debug) {
        console.log("APIToolkit: publish prepared payload ");
        console.dir(payload);
      }
      
      this.publishMessage(payload);
    };
  }
  private attachResponseListeners(res: Response, callback: any) {
    res.on("finish", callback);
    res.on("error", callback);
  }

  private modifyResSend(res: Response): any {
    let respBody: any = null;

    const oldSend = res.send;
    res.send = (val) => {
      respBody = val;
      return oldSend.apply(res, [val]);
    };

    return respBody;
  }

  private createPayload(start_time: bigint, req: Request, res: Response, respBody: any): Payload {
    // Get information from the request and response objects
    const reqBody = this.getRequestBody(req);
    const reqHeaders = this.getHeaders(req.headers);
    const resHeaders = this.getHeaders(res.getHeaders());
    const queryParams = this.getQueryParams(req.query);
    const pathParams = req.params ?? {};
    const urlPath = this.getUrlPath(req);
    const rawURL = req.originalUrl;

    // Construct and return the payload object
    return {
      duration: Number(process.hrtime.bigint() - start_time),
      host: req.hostname,
      method: req.method,
      path_params: pathParams,
      project_id: this.#project_id,
      proto_minor: 1,
      proto_major: 1,
      query_params: queryParams,
      raw_url: rawURL,
      referer: req.headers.referer ?? "",
      request_body: Buffer.from(this.redactFields(reqBody, this.#redactRequestBody)).toString(
        "base64"
      ),
      request_headers: this.redactHeaders(reqHeaders, this.#redactHeaders),
      response_body: Buffer.from(this.redactFields(respBody, this.#redactResponseBody)).toString(
        "base64"
      ),
      response_headers: this.redactHeaders(resHeaders, this.#redactHeaders),
      sdk_type: "JsExpress",
      status_code: res.statusCode,
      timestamp: new Date().toISOString(),
      url_path: urlPath,
    };
  }

  private getRequestBody(req: Request): string {
    let reqBody = "";
    if (req.body) {
      try {
        if (req.is("multipart/form-data")) {
          if (req.file) {
            req.body[req.file.fieldname] = `[${req.file.mimetype}_FILE]`;
          } else if (req.files) {
            if (!Array.isArray(req.files)) {
              for (const file in req.files) {
                req.body[file] = (req.files[file] as any).map((f: any) => `[${f.mimetype}_FILE]`);
              }
            } else {
              for (const file of req.files) {
                req.body[file.fieldname] = `[${file.mimetype}_FILE]`;
              }
            }
          }
        }
        reqBody = JSON.stringify(req.body);
      } catch (error) {
        reqBody = String(req.body);
      }
    }
    return reqBody;
  }

  private getHeaders(headers: any): Map<string, string[]> {
    const objEntries: Array<[string, string[]]> = Object.entries(headers).map(
      ([k, v]: [string, any]): [string, string[]] => [k, Array.isArray(v) ? v : [v]]
    );
    return new Map<string, string[]>(objEntries);
  }

  private getQueryParams(query: any): Object {
    const queryObjEntries = Object.entries(query).map(([k, v]) => {
      if (typeof v === "string") return [k, [v]];
      return [k, v];
    });
    return Object.fromEntries(queryObjEntries);
  }

  private getUrlPath(req: Request): string {
    let urlPath = req.route?.path ?? "";
    if (req.baseUrl && req.baseUrl !== "") {
      urlPath = req.baseUrl + urlPath;
    }
    return urlPath;
  }

  private redactHeaders(headers: Map<string, string[]>, headersToRedact: string[]) {
    const redactedHeaders: Map<string, string[]> = new Map();
    const headersToRedactLowerCase = headersToRedact.map((header) => header.toLowerCase());

    for (let [key, value] of headers) {
      const lowerKey = key.toLowerCase();
      const isRedactKey = headersToRedactLowerCase.includes(lowerKey) || lowerKey === "cookie";
      redactedHeaders.set(key, isRedactKey ? ["[CLIENT_REDACTED]"] : value);
    }

    return redactedHeaders;
  }

  private redactFields(body: string, fieldsToRedact: string[]): string {
    try {
      const bodyOB = JSON.parse(body);
      fieldsToRedact.forEach((path) => {
        jsonpath.apply(bodyOB, path, function () {
          return "[CLIENT_REDACTED]";
        });
      });
      return JSON.stringify(bodyOB);
    } catch (error) {
      return body;
    }
  }
}
