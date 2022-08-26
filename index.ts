import fetch from 'node-fetch';
import { PubSub, Topic } from '@google-cloud/pubsub';
import { NextFunction, Request, Response } from 'express';
import { hrtime } from 'node:process';

export type Config = {
  rootURL?: string,
  apiKey: string,
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
  path_params: Map<string, string>
  project_id: string
  proto_major: number
  proto_minor: number
  query_params: Map<string, string[]>
  raw_url: string
  referer: string
  request_body: string
  request_headers: Map<string, string[]>
  response_body: string
  response_headers: Map<string, string[]>
  sdk_type: string
  status_code: number
  timestamp: string
  url_path: string
}

export class APIToolkit {
  #topic: string;
  #pubsub: PubSub;
  #project_id: string;

  constructor(pubsub: PubSub, topic: string, project_id: string) {
    this.#topic = topic
    this.#pubsub = pubsub
    this.#project_id = project_id

    this.expressMiddleware = this.expressMiddleware.bind(this)
  }

  static async initialize(apiKey: string, rootURL: string = "https://app.apitoolkit.io") {
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

    return new APIToolkit(pubsubClient, topic_id, project_id)
  }

  public async expressMiddleware(req: Request, res: Response, next: NextFunction) {
    const start_time = hrtime.bigint();
    const chunks: Uint8Array[] = [];
    let respBody: string = '';
    let reqBody = "";
    req.on('data', function(chunk) { reqBody += chunk })
    req.on('end', function() {
      // req.rawBody = data;
      // next();
    })

    const oldSend = res.send;
    res.send = (val) => {
      respBody = JSON.stringify(val)
      return oldSend.apply(res, [val])
    }

    // const oldWrite = res.write;
    // const oldEnd = res.end;
    // res.write = (chunk, ...args) => {
    //   console.log("RES.WRITE :", chunk)

    //   chunks.push(chunk);
    //   // @ts-ignore
    //   return oldWrite.apply(res, [chunk, ...args]);
    // };

    // res.end = (chunk: Function | any, encoding?: Function | string, callback?: Function) => {
    //   if (chunk) chunks.push(chunk);
    //   respBody = Buffer.concat(chunks).toString('base64');
    //   // @ts-ignore
    //   return oldEnd.apply(res, [chunk, encoding, callback]);
    // };


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
      const pathParams = new Map(Object.entries(req.params ?? {}))

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
        request_body: Buffer.from(reqBody).toString('base64'),
        request_headers: reqHeaders,
        response_body: Buffer.from(respBody).toString('base64'),
        response_headers: resHeaders,
        sdk_type: "JsExpress",
        status_code: res.statusCode,
        timestamp: new Date().toISOString(),
        url_path: req.route.path,
      }
      this.#pubsub.topic(this.#topic).publishMessage({ json: payload })
    }

    const onRespFinishedCB = onRespFinished(this.#pubsub.topic(this.#topic), req, res)
    // res.on('close', onRespFinishedCB)
    res.on('finish', onRespFinishedCB)
    res.on('error', onRespFinishedCB)

    next()
  }
}
