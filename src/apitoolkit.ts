import { PubSub, Topic } from '@google-cloud/pubsub';
import { asyncLocalStorage, buildPayload, observeAxios, observeAxiosGlobal, ReportError } from 'apitoolkit-js';
import { AxiosInstance, AxiosStatic } from 'axios';
import { Application, NextFunction, Request, Response } from 'express';
import fetch from 'sync-fetch';
import { v4 as uuidv4 } from 'uuid';
export type ATError = {
  when: string; // timestamp
  error_type: string;
  root_error_type?: string;
  message: string;
  root_error_message?: string;
  stack_trace: string;
};

export type Payload = {
  duration: number;
  host: string;
  method: string;
  path_params: Record<string, any>;
  project_id: string;
  proto_major: number;
  proto_minor: number;
  query_params: Record<string, any>;
  raw_url: string;
  referer: string;
  request_body: string;
  request_headers: Record<string, any>;
  response_body: string;
  response_headers: Record<string, any>;
  sdk_type: string;
  status_code: number;
  timestamp: string;
  url_path: string;
  errors: ATError[];
  service_version?: string;
  tags: string[];
  msg_id?: string;
  parent_id?: string;
};

export type Config = {
  apiKey: string;
  rootURL?: string;
  debug?: boolean;
  redactHeaders?: string[];
  redactRequestBody?: string[];
  redactResponseBody?: string[];
  clientMetadata?: ClientMetadata;
  ignoreEndpoints?: string[];
  serviceVersion?: string;
  tags?: string[];
  monitorAxios?: AxiosInstance;
};

type ClientMetadata = {
  project_id: string;
  pubsub_project_id: string;
  topic_id: string;
  pubsub_push_service_account: any;
};

export class APIToolkit {
  #topicName: string | undefined;
  #topic: Topic | undefined;
  #pubsub: PubSub | undefined;
  #project_id: string | undefined;
  #config: Config;
  publishMessage: (payload: Payload) => void;

  constructor(
    pubsub: PubSub | undefined,
    topicName: string | undefined,
    project_id: string | undefined,
    config: Config
  ) {
    this.#topicName = topicName;
    this.#pubsub = pubsub;
    this.#project_id = project_id;
    this.#config = config;
    if (this.#pubsub && this.#topicName) {
      this.#topic = this.#pubsub?.topic(this.#topicName);
    }

    this.publishMessage = (payload: Payload) => {
      const callback = (err: any, messageId: any) => {
        if (this.#config?.debug) {
          console.log('APIToolkit: pubsub publish callback called; messageId: ', messageId, ' error ', err);
          if (err != null) {
            console.log('APIToolkit: error publishing message to pubsub');
            console.error(err);
          }
        }
      };
      if (this.#topic) {
        this.#topic.publishMessage({ json: payload }, callback);
      } else {
        if (this.#config?.debug) {
          console.error('APIToolkit: error publishing message to pubsub, Undefined topic');
        }
      }
    };
    if (config.monitorAxios) {
      observeAxiosGlobal(
        config.monitorAxios as any,
        undefined,
        config.redactHeaders,
        config.redactRequestBody,
        config.redactResponseBody,
        this
      );
    }
    this.expressMiddleware = this.expressMiddleware.bind(this);
  }

  static NewClient(config: Config) {
    let { rootURL = 'https://app.apitoolkit.io', clientMetadata } = config;

    let pubsubClient;
    if (clientMetadata == null || config.apiKey != '') {
      clientMetadata = this.getClientMetadata(rootURL, config.apiKey);
      if (!clientMetadata) {
        return new APIToolkit(pubsubClient, undefined, undefined, config);
      }
      pubsubClient = new PubSub({
        projectId: clientMetadata.pubsub_project_id,
        authClient: new PubSub().auth.fromJSON(clientMetadata.pubsub_push_service_account),
      });
    }

    const { topic_id, project_id } = clientMetadata;
    if (config.debug) {
      console.log('apitoolkit:  initialized successfully');
      console.dir(pubsubClient);
    }

    return new APIToolkit(pubsubClient, topic_id, project_id, config);
  }

  public async close() {
    await this.#topic?.flush();
    await this.#pubsub?.close();
  }

  static getClientMetadata(rootURL: string, apiKey: string) {
    const resp = fetch(rootURL + '/api/client_metadata', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        Accept: 'application/json',
      },
    });
    if (!resp.ok) {
      if (resp.status === 401) {
        throw new Error('APIToolkit: Invalid API Key');
      } else {
        console.error(`Error getting apitoolkit client_metadata ${resp.status}`);
        return;
      }
    }
    return resp.json() as ClientMetadata;
  }

  public getConfig() {
    return { project_id: this.#project_id, config: this.#config };
  }

  public observeAxios(
    axiosInstance: AxiosStatic,
    urlWildcard?: string | undefined,
    redactHeaders?: string[] | undefined,
    redactRequestBody?: string[] | undefined,
    redactResponseBody?: string[] | undefined
  ) {
    return observeAxios(
      axiosInstance as any,
      urlWildcard,
      redactHeaders,
      redactRequestBody,
      redactResponseBody,
      true,
      this
    );
  }
  public ReportError = ReportError;

  public expressMiddleware(req: Request, res: Response, next: NextFunction) {
    if (this.#project_id === undefined) {
      // If APItoolkit wasnt initialized correctly, esp using Async initializer, then log error
      console.log('APIToolkit: expressMiddleware called, but apitoolkit was not correctly setup. Doing nothing.');
      next();
      return;
    }

    asyncLocalStorage.run(new Map(), () => {
      asyncLocalStorage.getStore()!.set('AT_client', this);
      asyncLocalStorage.getStore()!.set('AT_project_id', this.#project_id);
      asyncLocalStorage.getStore()!.set('AT_config', this.#config);
      asyncLocalStorage.getStore()!.set('AT_errors', []);
      const msg_id: string = uuidv4();
      asyncLocalStorage.getStore()!.set('AT_msg_id', msg_id);

      if (this.#config?.debug) {
        console.log('APIToolkit: expressMiddleware called');
      }

      const start_time = process.hrtime.bigint();
      let respBody: any = '';
      const oldSend = res.send;
      res.send = (val) => {
        respBody = val;
        return oldSend.apply(res, [val]);
      };

      const onRespFinished = (topic: Topic | undefined, req: Request, res: Response) => (_err: any) => {
        res.removeListener('close', onRespFinished(topic, req, res));
        res.removeListener('error', onRespFinished(topic, req, res));
        res.removeListener('finish', onRespFinished(topic, req, res));

        let url_path = req.route?.path || '';

        const ignoredRoute =
          this.#config.ignoreEndpoints?.some((e) => {
            const endpoint = req.method + url_path;
            return endpoint.toLowerCase().endsWith(e.replace(' ', '').toLowerCase());
          }) || false;

        if (ignoredRoute) {
          if (this.#config?.debug) {
            console.log('APIToolkit: ignored endpoint=>', `${req.method} ${url_path}`);
          }
          return;
        }

        let reqBody = '';
        if (req.body) {
          try {
            if (req.is('multipart/form-data')) {
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
        if (url_path == '' && req.method.toLowerCase() !== 'head') {
          url_path = findMatchedRoute(req.app, req.method, req.originalUrl);
        } else if (req.baseUrl && req.baseUrl != '') {
          // base url doesn't contain path params
          if (req.originalUrl.startsWith(req.baseUrl)) {
            url_path = req.baseUrl + url_path;
          } else {
            // base url has path params
            url_path = findMatchedRoute(req.app, req.method, req.originalUrl);
          }
        }
        const errors = asyncLocalStorage.getStore()?.get('AT_errors') ?? [];
        if (this.#project_id) {
          const payload = buildPayload({
            start_time,
            requestHeaders: req.headers,
            responseHeaders: res.getHeaders(),
            sdk_type: 'JsExpress',
            reqQuery: req.query,
            raw_url: req.originalUrl,
            url_path: url_path,
            reqParams: req.params,
            status_code: res.statusCode,
            reqBody,
            respBody,
            method: req.method,
            host: req.hostname,
            redactRequestBody: this.#config?.redactRequestBody ?? [],
            redactResponseBody: this.#config?.redactResponseBody ?? [],
            redactHeaderLists: this.#config?.redactHeaders ?? [],
            project_id: this.#project_id,
            errors,
            service_version: this.#config?.serviceVersion,
            tags: this.#config?.tags ?? [],
            msg_id,
            parent_id: undefined,
          });

          if (this.#config?.debug) {
            console.log('APIToolkit: publish prepared payload ');
            console.dir(payload);
          }
          this.publishMessage(payload);
        }
      };

      const onRespFinishedCB = onRespFinished(this.#topic, req, res);
      res.on('finish', onRespFinishedCB);
      res.on('error', onRespFinishedCB);
      // res.on('close', onRespFinishedCB)

      try {
        next();
      } catch (error) {
        next(error);
      }
    });
  }

  public errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
    void ReportError(err);
    next(err);
  }
}

export const findMatchedRoute = (app: Application, method: string, url: string): string => {
  try {
    const path = url.split('?')[0];
    const stack = app._router.stack;
    let final_path = '';

    const gatherRoutes = (stack: any, build_path: string, path: string) => {
      for (const layer of stack) {
        if (layer.route) {
          if (path.startsWith(layer.path)) {
            const route = layer.route;
            if (route.methods[method.toLowerCase()]) {
              const match = layer.path === path || layer.regex.test(path);
              if (match) {
                build_path += route.path;
                final_path = build_path;
                return;
              }
            }
          }
        } else if (layer.name === 'router' && layer.handle.stack) {
          if (path.startsWith(layer.path)) {
            build_path += transformPath(layer.params, layer.path);
            path = path.replace(layer.path, '');
            gatherRoutes(layer.handle.stack, build_path, path);
          }
        }
      }
    };
    gatherRoutes(stack, '', path);
    return final_path;
  } catch (error) {
    return '';
  }
};

function transformPath(params: Record<string, string>, path: string): string {
  let transformedPath = path;
  for (const [key, value] of Object.entries(params)) {
    const placeholder = `:${key}`;
    transformedPath = transformedPath.replace(value, placeholder);
  }
  return transformedPath;
}

export default APIToolkit;
