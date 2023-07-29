import fetch from 'node-fetch';
import { PubSub, Topic } from '@google-cloud/pubsub';
import { NextFunction, Request, Response } from 'express';
import { hrtime } from 'node:process';
import jsonpath from "jsonpath"

export type Config = {
  apiKey: string;
  rootURL?: string;
  debug?: boolean;
  redactHeaders?: string[];
  redactRequestBody?: string[];
  redactResponseBody?: string[]
}

type ClientMetadata = {
  project_id: string,
  pubsub_project_id: string,
  topic_id: string,
  pubsub_push_service_account: any,
}

type Payload = {
  duration: number
  host: string
  method: string
  path_params: Object
  project_id: string
  proto_major: number
  proto_minor: number
  query_params: Object
  raw_url: string
  referer: string
  request_body: string
  request_headers: Object
  response_body: string
  response_headers: Object
  sdk_type: string
  status_code: number
  timestamp: string
  url_path: string
}


export default class APIToolkit {
  #topic: string;
  #pubsub: PubSub;
  #project_id: string;
  #redactHeaders: string[]
  #redactRequestBody: string[]
  #redactResponseBody: string[]
  #debug: boolean

  constructor(pubsub: PubSub, topic: string, project_id: string, redactHeaders: string[], redactReqBody: string[], redactRespBody: string[], debug: boolean) {
    this.#topic = topic
    this.#pubsub = pubsub
    this.#project_id = project_id
    this.#redactHeaders = redactHeaders
    this.#redactRequestBody = redactReqBody
    this.#redactResponseBody = redactRespBody
    this.#debug = debug

    this.expressMiddleware = this.expressMiddleware.bind(this)
  }

  static async NewClient({ apiKey, rootURL = "https://app.apitoolkit.io", redactHeaders = [], redactRequestBody = [], redactResponseBody = [], debug = false }: Config) {
    const resp = await fetch(rootURL + "/api/client_metadata", {
      method: 'GET',
      headers: {
        Authorization: "Bearer " + apiKey,
        Accept: 'application/json',
      },
    })
    if (!resp.ok) throw new Error(`Error getting apitoolkit client_metadata ${resp.status}`);

    const clientMetadata: ClientMetadata = await resp.json();
    const { pubsub_project_id, topic_id, project_id } = clientMetadata;
    const pubsubClient = new PubSub({
      projectId: pubsub_project_id
    });

    if (debug) {
      console.log("apitoolkit:  initialized successfully")
      console.dir(pubsubClient)
    }

    return new APIToolkit(pubsubClient, topic_id, project_id, redactHeaders, redactRequestBody, redactResponseBody, debug);
  }

  public async expressMiddleware(req: Request, res: Response, next: NextFunction) {
    if (this.#debug) {
      console.log("APIToolkit: expressMiddleware called")
    }

    const start_time = hrtime.bigint();
    const chunks: Uint8Array[] = [];
    let respBody: any = '';
    let reqBody = "";
    req.on('data', function (chunk) { reqBody += chunk })

    const oldSend = res.send;
    res.send = (val) => {
      respBody = val
      return oldSend.apply(res, [val])
    }

    const oldWrite = res.write;
    const oldEnd = res.end;
    res.write = (chunk, ...args) => {
      chunks.push(chunk);
      // @ts-ignore
      return oldWrite.apply(res, [chunk, ...args]);
    };
    res.end = (chunk: Function | any, encoding?: Function | string, callback?: Function) => {
      if (chunk)
        chunks.push(chunk);
      respBody = Buffer.from(chunks.join('')).toString();
      // @ts-ignore
      return oldEnd.apply(res, [chunk, encoding, callback]);
    };

    const onRespFinished = (topic: Topic, req: Request, res: Response) => (err: any) => {
      res.removeListener('close', onRespFinished(topic, req, res))
      res.removeListener('error', onRespFinished(topic, req, res))
      res.removeListener('finish', onRespFinished(topic, req, res))

      const reqObjEntries = Object.entries(req.headers).map(([k, v]) => {
        if (typeof v === "string") return [k, [v]]
        return [k, v]
      })
      const reqHeaders = Object.fromEntries(reqObjEntries)

      const resObjEntries = Object.entries(res.getHeaders()).map(([k, v]) => {
        if (typeof v === "string") return [k, [v]]
        return [k, v]
      })
      const resHeaders = Object.fromEntries(resObjEntries)

      const queryObjEntries = Object.entries(req.query).map(([k, v]) => {
        if (typeof v === "string") return [k, [v]]
        return [k, v]
      })
      const queryParams = Object.fromEntries(queryObjEntries)
      const pathParams = req.params ?? {}

      const payload: Payload = {
        duration: Number(hrtime.bigint() - start_time),
        host: req.hostname,
        method: req.method,
        path_params: pathParams,
        project_id: this.#project_id,
        proto_minor: 1,
        proto_major: 1,
        query_params: queryParams,
        raw_url: req.url,
        referer: req.headers.referer ?? '',
        request_body: Buffer.from(this.redactFields(reqBody, this.#redactRequestBody)).toString('base64'),
        request_headers: this.redactHeaders(reqHeaders, this.#redactHeaders),
        response_body: Buffer.from(this.redactFields(respBody, this.#redactResponseBody)).toString('base64'),
        response_headers: this.redactHeaders(resHeaders, this.#redactHeaders),
        sdk_type: "JsExpress",
        status_code: res.statusCode,
        timestamp: new Date().toISOString(),
        url_path: req.route.path,
      }
      if (this.#debug) {
        console.log("APIToolkit: publish prepared payload ")
        console.dir(payload)
      }
      this.#pubsub.topic(this.#topic).publishMessage({ json: payload })
    }

    const onRespFinishedCB = onRespFinished(this.#pubsub.topic(this.#topic), req, res)
    // res.on('close', onRespFinishedCB)
    res.on('finish', onRespFinishedCB)
    res.on('error', onRespFinishedCB)

    next()
  }

  private redactHeaders(headers: any, headersToRedact: string[]) {
    for (const [key, value] of Object.entries(headers)) {
      if (headersToRedact.some(header => header.includes(key) || header.includes(key.toLocaleLowerCase()))) {
        headers[key] = ["[CLIENT_REDACTED]"]
      } else if (key === "Cookie" || key === "cookie") {
        headers[key] = ["[CLIENT_REDACTED]"]
      } else {
        headers[key] = value;
      }
    }
    return headers;
  }

  private redactFields(body: string, fieldsToRedact: string[]): string {
    try {
      const bodyOB = JSON.parse(body)
      fieldsToRedact.forEach(path => {
        jsonpath.apply(bodyOB, path, function () { return "[CLIENT_REDACTED]" });
      })
      return JSON.stringify(bodyOB)
    } catch (error) {
      return body
    }
  }
}
