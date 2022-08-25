import fetch from 'node-fetch';
import { PubSub, Topic } from '@google-cloud/pubsub';
import { NextFunction, Request, Response } from 'express';
// const { performance } = require("perf_hooks");
import { hrtime } from 'node:process';
// const { fetch } = require('node-fetch');

export type Config = {
  rootURL?: string,
  apiKey: string,
}

type Client = {
  config: Config,
  topic: Topic,
}

type ClientMetadata = {
  project_id: string,
  pubsub_project_id: string,
  topic_id: string,
  pubsub_push_service_account: any,
}

export async function init(cfg: Config) {
  let url = "https://app.apitoolkit.io"
  if (cfg.rootURL && cfg.rootURL != "") {
    url = cfg.rootURL
  }

  console.log(url + "/api/client_metadata")
  const resp = await fetch(url + "/api/client_metadata", {
    method: 'GET',
    headers: {
      Authorization: "Bearer " + cfg.apiKey,
      Accept: 'application/json',
    },
  })
  // if (!resp.ok) {
  //   throw new Error(`Error getting apitoolkit client_metadata ${resp.status}`);
  // }
  let clientMetadata: ClientMetadata = await resp.json();
  console.dir(clientMetadata);


  let { pubsub_project_id, topic_id } = clientMetadata;

  const pubsubClient = new PubSub({
    projectId: pubsub_project_id
  });
  const topic = pubsubClient.topic(topic_id);

  const client: Client = {
    config: cfg,
    topic: topic,
  }

  return client
}


class APIToolkit {
  #topic: Topic;

  constructor(topic: Topic) {
    this.#topic = topic
  }

  static async initialize(apiKey: string, rootURL: string = "https://app.apitoolkit.io") {
    const resp = await fetch(rootURL + "/api/client_metadata", {
      method: 'GET',
      headers: {
        Authorization: "Bearer " + apiKey,
        Accept: 'application/json',
      },
    })
    // if (!resp.ok) {
    //   throw new Error(`Error getting apitoolkit client_metadata ${resp.status}`);
    // }
    let clientMetadata: ClientMetadata = await resp.json();
    console.dir(clientMetadata);


    let { pubsub_project_id, topic_id } = clientMetadata;

    const pubsubClient = new PubSub({
      projectId: pubsub_project_id
    });
    const topic = pubsubClient.topic(topic_id);

    // const client: Client = {
    //   topic: topic,
    // }

    // return client
    return new APIToolkit(topic)
  }

  public expressMiddleware(req: Request, res: Response, next: NextFunction) {
    const start_time = hrtime.bigint();

    const oldWrite = res.write;
    const oldEnd = res.end;
    const chunks: any[] = [];
    let respBody: string = '';

    res.write = (chunk, ...args) => {
      chunks.push(chunk);
      return oldWrite.apply(res, [chunk, ...args]);
    };

    res.end = (chunk, ...args) => {
      if (chunk) chunks.push(chunk);
      respBody = Buffer.concat(chunks).toString('base64');
      return oldEnd.apply(res, [chunk, ...args]);
    };



    next()
    console.log(hrtime.bigint() - start_time)
    console.dir(req.headers)
    console.dir(res.getHeaders())

    const reqObjEntries = Object.entries(req.headers).map(([k, v]) => {
      if (typeof v === "string") {
        return [k, [v]]
      }
      return [k, v]
    })
    const reqHeaders = Object.fromEntries(reqObjEntries)

    const resObjEntries = Object.entries(res.getHeaders()).map(([k, v]) => {
      if (typeof v === "string") {
        return [k, [v]]
      }
      return [k, v]
    })
    const resHeaders = Object.fromEntries(resObjEntries)

    const queryObjEntries = Object.entries(req.query).map(([k, v]) => {
      if (typeof v === "string") {
        return [k, [v]]
      }
      return [k, v]
    })
    const queryParams = Object.fromEntries(queryObjEntries)


    // req.headers.map(k,v=>console.log(k, v))

    const payload: Payload = {
      // path_params: req.params,
      duration: hrtime.bigint() - start_time,
      host: req.hostname,
      method: req.method,
      path_params: new Map(Object.entries(req.params)),
      project_id: "", // FIXME: 
      proto_minor: 1,
      proto_major: 1,
      query_params: queryParams,
      raw_url: req.url,
      referer: req.headers.referer ?? '',
      request_body: new Buffer(req.body).toString('base64'),
      request_headers: reqHeaders,
      response_body: respBody,
      response_headers: resHeaders,
      sdk_type: "JsExpress",
      status_code: res.statusCode,
      timestamp: new Date().toISOString(),
      url_path: req.url,

    }

    console.log("test middleware 🔥", payload)

  }

}




type Payload = {
  duration: bigint
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
