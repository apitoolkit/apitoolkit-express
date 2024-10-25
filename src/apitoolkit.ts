import fetch from "sync-fetch";
import { v4 as uuidv4 } from "uuid";

import { Span, Tracer } from "@opentelemetry/api";
import { Application, NextFunction, Request, Response } from "express";
import { redactFields } from "apitoolkit-js/lib/payload";
import { asyncLocalStorage, ReportError } from "apitoolkit-js";
export { ReportError } from "apitoolkit-js";

export type Config = {
  apiKey: string;
  rootURL?: string;
  debug?: boolean;
  redactHeaders?: string[];
  redactRequestBody?: string[];
  redactResponseBody?: string[];
  captureRequestBody?: boolean;
  captureResponseBody?: boolean;
  clientMetadata?: ClientMetadata;
  tags?: string[];
  serviceVersion?: string;
  tracer: Tracer;
};

type ClientMetadata = {
  project_id: string;
  pubsub_project_id: string;
  topic_id: string;
};

export class APIToolkit {
  private tracer: Tracer;
  private config: Config;
  private project_id?: string;
  private apitoolkit_key?: string;
  private captureRequestBody?: boolean;
  private captureResponseBody?: boolean;

  constructor(config: Config, apiKey: string, projectId?: string) {
    this.config = config;
    this.tracer = config.tracer;
    this.captureRequestBody = config.captureRequestBody || false;
    this.captureResponseBody = config.captureResponseBody || false;

    if (projectId) {
      this.project_id = projectId;
      this.apitoolkit_key = apiKey;
    }

    this.expressMiddleware = this.expressMiddleware.bind(this);
  }

  public expressErrorHandler(
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    ReportError(err);
    next(err);
  }

  public expressMiddleware(req: Request, res: Response, next: NextFunction) {
    if (this.project_id === undefined) {
      console.log(
        "APIToolkit: expressMiddleware called, but apitoolkit was not correctly setup. Doing nothing."
      );
      next();
      return;
    }

    asyncLocalStorage.run(new Map(), () => {
      let span: Span | undefined;
      const store = asyncLocalStorage.getStore();

      const msg_id: string = uuidv4();
      if (this.tracer) {
        span = this.tracer.startSpan("apitoolkit-http-span");
      }
      if (store) {
        store.set("apitoolkit-span", span);
        store.set("apitoolkit-msg-id", msg_id);
        store.set("AT_errors", []);
      }

      if (this.config?.debug) {
        console.log("APIToolkit: expressMiddleware called");
      }

      let respBody: any = "";
      const oldSend = res.send;
      res.send = (val) => {
        if (this.captureResponseBody) {
          respBody = val;
        }
        return oldSend.apply(res, [val]);
      };

      const onRespFinished = (req: Request, res: Response) => () => {
        res.removeListener("close", onRespFinished(req, res));
        res.removeListener("error", onRespFinished(req, res));
        res.removeListener("finish", onRespFinished(req, res));
        try {
          let reqBody = "";
          if (req.body && this.captureRequestBody) {
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
            } catch {
              reqBody = String(req.body);
            }
          }
          let url_path = req.route?.path || "";
          if (url_path == "" && req.method.toLowerCase() !== "head") {
            url_path = findMatchedRoute(req.app, req.method, req.originalUrl);
          } else if (req.baseUrl && req.baseUrl != "") {
            if (req.originalUrl.startsWith(req.baseUrl)) {
              url_path = req.baseUrl + url_path;
            } else {
              url_path = findMatchedRoute(req.app, req.method, req.originalUrl);
            }
          }
          if (span) {
            // if (url_path !== "") {
            //   span.updateName(`${req.method} ${url_path}`);
            // }
            span.setAttribute("at-project-key", this.apitoolkit_key || "");
            span.setAttribute("apitoolkit.msg_id", msg_id);
            span.setAttribute("http.route", url_path);
            span.setAttribute("http.request.method", req.method);
            span.setAttribute("http.response.status_code", res.statusCode);
            span.setAttribute(
              "http.request.query_params",
              JSON.stringify(req.query)
            );
            span.setAttribute(
              "http.request.path_params",
              JSON.stringify(req.params)
            );
            span.setAttribute("apitoolkit.sdk_type", "JsExpress");
            const reqHeaders = Object.entries(req.headers);

            reqHeaders.forEach(([header, value]) => {
              const isRedacted = this.config.redactHeaders?.some(
                (h) =>
                  h.toLowerCase() === header.toLowerCase() ||
                  ["cookie", "authorization"].includes(h.toLowerCase())
              );
              const headerVal = isRedacted
                ? "[CLIENT_REDACTED]"
                : String(value);
              span.setAttribute("http.request.header." + header, headerVal);
            });
            const resHeaders = Object.entries(res.getHeaders());
            resHeaders.forEach(([header, value]) => {
              const isRedacted = this.config.redactHeaders?.some(
                (h) =>
                  h.toLowerCase() === header.toLowerCase() ||
                  ["cookie", "authorization"].includes(h.toLowerCase())
              );
              const headerVal = isRedacted
                ? "[CLIENT_REDACTED]"
                : String(value);
              span.setAttribute("http.response.header." + header, headerVal);
            });
            span.setAttribute(
              "http.request.body",
              Buffer.from(
                redactFields(reqBody, this.config.redactRequestBody || [])
              ).toString("base64")
            );
            span.setAttribute(
              "http.response.body",
              Buffer.from(
                redactFields(respBody, this.config.redactRequestBody || [])
              ).toString("base64")
            );
            span.setAttribute(
              "apitoolkit.errors",
              JSON.stringify(store?.get("AT_errors") || [])
            );
            span.setAttribute(
              "apitoolkit.service_version",
              this.config.serviceVersion || ""
            );
            span.setAttribute("apitoolkit.tags", this.config.tags || []);
          }
        } catch (error) {
          if (this.config?.debug) {
            console.log(error);
          }
        } finally {
          if (this.tracer) {
            span?.end();
          }
        }
      };

      const onRespFinishedCB = onRespFinished(req, res);
      res.on("finish", onRespFinishedCB);
      res.on("error", onRespFinishedCB);
      try {
        next();
      } catch (error) {
        next(error);
      }
    });
  }
  public ReportError = ReportError;

  static NewClient(config: Config) {
    const { rootURL = "https://app.apitoolkit.io", clientMetadata } = config;

    if (!clientMetadata || config.apiKey != "") {
      const clientMeta = this.getClientMetadata(rootURL, config.apiKey);
      if (!clientMeta) {
        return new APIToolkit(config, config.apiKey, undefined);
      } else {
        return new APIToolkit(config, config.apiKey, clientMeta.project_id);
      }
    }
    return new APIToolkit(config, config.apiKey, undefined);
  }

  static getClientMetadata(rootURL: string, apiKey: string) {
    const resp = fetch(rootURL + "/api/client_metadata", {
      method: "GET",
      headers: {
        Authorization: "Bearer " + apiKey,
        Accept: "application/json",
      },
    });
    if (!resp.ok) {
      if (resp.status === 401) {
        throw new Error("APIToolkit: Invalid API Key");
      } else {
        console.error(
          `Error getting apitoolkit client_metadata ${resp.status}`
        );
        return;
      }
    }
    return resp.json() as ClientMetadata;
  }
}

export const findMatchedRoute = (
  app: Application,
  method: string,
  url: string
): string => {
  try {
    const path = url.split("?")[0];
    const stack = app._router.stack;
    let final_path = "";

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
        } else if (layer.name === "router" && layer.handle.stack) {
          if (path.startsWith(layer.path)) {
            build_path += transformPath(layer.params, layer.path);
            path = path.replace(layer.path, "");
            gatherRoutes(layer.handle.stack, build_path, path);
          }
        }
      }
    };
    gatherRoutes(stack, "", path);
    return final_path;
  } catch {
    return "";
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
