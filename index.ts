import fetch from "node-fetch";
import { PubSub, Topic } from "@google-cloud/pubsub";
import { NextFunction, Request, Response } from "express";
import { AsyncLocalStorage } from "async_hooks";
import { ATError, Payload, buildPayload } from "./payload";
import { v4 as uuidv4 } from "uuid";

export type Config = {
  apiKey: string;
  rootURL?: string;
  debug?: boolean;
  redactHeaders?: string[];
  redactRequestBody?: string[];
  redactResponseBody?: string[];
  clientMetadata?: ClientMetadata;
  serviceVersion?: string;
  tags?: string[];
};

type ClientMetadata = {
  project_id: string;
  pubsub_project_id: string;
  topic_id: string;
  pubsub_push_service_account: any;
};

export const asyncLocalStorage = new AsyncLocalStorage<Map<string, any>>();

export class APIToolkit {
  #topic: string;
  #pubsub: PubSub | undefined;
  #project_id: string;
  #config: Config;
  publishMessage: (payload: Payload) => void;

  constructor(pubsub: PubSub | undefined, topic: string, project_id: string, config: Config) {
    this.#topic = topic;
    this.#pubsub = pubsub;
    this.#project_id = project_id;
    this.#config = config;
    this.publishMessage = (payload: Payload) => {
      const callback = (err: any, messageId: any) => {
        if (this.#config.debug) {
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

  static async NewClient(config: Config) {
    var { apiKey, rootURL = "https://app.apitoolkit.io", clientMetadata } = config;

    var pubsubClient;
    if (clientMetadata == null || apiKey != "") {
      clientMetadata = await this.getClientMetadata(rootURL, apiKey);
      pubsubClient = new PubSub({
        projectId: clientMetadata.pubsub_project_id,
        authClient: new PubSub().auth.fromJSON(clientMetadata.pubsub_push_service_account),
      });
    }

    const { pubsub_project_id, topic_id, project_id, pubsub_push_service_account } = clientMetadata;
    if (config.debug) {
      console.log("apitoolkit:  initialized successfully");
      console.dir(pubsubClient);
    }

    return new APIToolkit(pubsubClient, topic_id, project_id, config);
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

  // public getStore() {
  //   return this.asyncLocalStorage.getStore();
  // }

  public async expressMiddleware(req: Request, res: Response, next: NextFunction) {
    asyncLocalStorage.run(new Map(), () => {
      asyncLocalStorage.getStore()!.set("AT_client", this);
      asyncLocalStorage.getStore()!.set("AT_project_id", this.#project_id);
      asyncLocalStorage.getStore()!.set("AT_config", this.#config);
      asyncLocalStorage.getStore()!.set("AT_errors", []);
      const msg_id: string = uuidv4();
      asyncLocalStorage.getStore()!.set("AT_msg_id", msg_id);

      if (this.#config.debug) {
        console.log("APIToolkit: expressMiddleware called");
      }

      const start_time = process.hrtime.bigint();
      let respBody: any = "";
      const oldSend = res.send;
      res.send = (val) => {
        respBody = val;
        return oldSend.apply(res, [val]);
      };

      const onRespFinished =
        (topic: Topic | undefined, req: Request, res: Response) => (err: any) => {
          res.removeListener("close", onRespFinished(topic, req, res));
          res.removeListener("error", onRespFinished(topic, req, res));
          res.removeListener("finish", onRespFinished(topic, req, res));

          let reqBody = "";
          if (req.body) {
            try {
              if (req.is("multipart/form-data")) {
                if (req.file) {
                  req.body[req.file.fieldname] = `[${req.file.mimetype}_FILE]`;
                } else if (req.files) {
                  if (!Array.isArray(req.files)) {
                    for (const file in req.files) {
                      req.body[file] = (req.files[file] as any).map(
                        (f: any) => `[${f.mimetype}_FILE]`
                      );
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

          const errors = asyncLocalStorage.getStore()?.get("AT_errors") ?? [];
          const payload = buildPayload(
            start_time,
            req,
            res,
            reqBody,
            respBody,
            this.#config.redactRequestBody ?? [],
            this.#config.redactResponseBody ?? [],
            this.#config.redactHeaders ?? [],
            this.#project_id,
            errors,
            this.#config.serviceVersion,
            this.#config.tags ?? [],
            msg_id,
            undefined
          );

          if (this.#config.debug) {
            console.log("APIToolkit: publish prepared payload ");
            console.dir(payload);
          }
          this.publishMessage(payload);
        };

      const onRespFinishedCB = onRespFinished(this.#pubsub?.topic(this.#topic), req, res);
      res.on("finish", onRespFinishedCB);
      res.on("error", onRespFinishedCB);
      // res.on('close', onRespFinishedCB)

      try {
        next();
      } catch (error) {
        next(error);
      }
    });
  }
}

export function ReportError(error: any) {
  if (asyncLocalStorage.getStore() == null) {
    console.log(
      "APIToolkit: ReportError used outside of the APIToolkit middleware's scope. Use the APIToolkitClient.ReportError instead, if you're not in a web context."
    );
    return Promise.reject(error);
  }

  const resp = normaliseError(error);
  if (!resp) {
    return;
  }

  const [nError, internalFrames] = resp;
  const atError = buildError(nError);
  var errList: ATError[] = asyncLocalStorage.getStore()!.get("AT_errors");
  errList.push(atError);
  asyncLocalStorage.getStore()!.set("AT_errors", errList);
}

// Recursively unwraps an error and returns the original cause.
function rootCause(err: Error): Error {
  let cause = err;
  while (cause && (cause as any).cause) {
    cause = (cause as any).cause;
  }
  return cause;
}

function normaliseError(maybeError: any): [Error, Number] | undefined {
  let error;
  let internalFrames = 0;

  // In some cases:
  //
  //  - the promise rejection handler (both in the browser and node)
  //  - the node uncaughtException handler
  //
  // We are really limited in what we can do to get a stacktrace. So we use the
  // tolerateNonErrors option to ensure that the resulting error communicates as
  // such.
  switch (typeof maybeError) {
    case "string":
    case "number":
    case "boolean":
      error = new Error(String(maybeError));
      internalFrames += 1;
      break;
    case "function":
      return;
    case "object":
      if (maybeError !== null && isError(maybeError)) {
        error = maybeError;
      } else if (maybeError !== null && hasNecessaryFields(maybeError)) {
        error = new Error(maybeError.message || maybeError.errorMessage);
        error.name = maybeError.name || maybeError.errorClass;
        internalFrames += 1;
      } else {
        // unsupported error
        return;
      }
      break;
    default:
    // unsupported errors found
  }

  return [error, internalFrames];
}

const hasNecessaryFields = (error: any): boolean =>
  (typeof error.name === "string" || typeof error.errorClass === "string") &&
  (typeof error.message === "string" || typeof error.errorMessage === "string");

function isError(value: any): boolean {
  switch (Object.prototype.toString.call(value)) {
    case "[object Error]":
      return true;
    case "[object Exception]":
      return true;
    case "[object DOMException]":
      return true;
    default:
      return value instanceof Error;
  }
}

function buildError(err: Error): ATError {
  const errType = err.constructor.name;

  const rootError = rootCause(err);
  const rootErrorType = rootError.constructor.name;

  return {
    when: new Date().toISOString(),
    error_type: errType,
    message: err.message,
    root_error_type: rootErrorType,
    root_error_message: rootError.message,
    stack_trace: err.stack ?? "",
  };
}

export default APIToolkit;
