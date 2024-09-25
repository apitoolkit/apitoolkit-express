import fetch from "sync-fetch";
import { logs, NodeSDK } from "@opentelemetry/sdk-node";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import {
  diag,
  DiagConsoleLogger,
  DiagLogLevel,
  Span,
  trace,
  Tracer,
} from "@opentelemetry/api";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-grpc";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { Application, NextFunction, Request, Response } from "express";
import { redactFields } from "apitoolkit-js/lib/payload";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { ClientRequest, IncomingMessage } from "http";

export type Config = {
  apiKey: string;
  serviceName: string;
  rootURL?: string;
  debug?: boolean;
  redactHeaders?: string[];
  redactRequestBody?: string[];
  redactResponseBody?: string[];
  clientMetadata?: ClientMetadata;
  ignoreEndpoints?: string[];
  serviceVersion?: string;
  tags?: string[];
  otelInstrumentated: boolean;
};

type ClientMetadata = {
  project_id: string;
  pubsub_project_id: string;
  topic_id: string;
};

class APIToolkit {
  private otelSDk?: NodeSDK;
  private tracer?: Tracer;
  private config: Config;
  private project_id?: string;
  private currentSpan: Span[] = [];

  constructor(config: Config, apiKey: string, projectId?: string) {
    this.config = config;
    if (projectId) {
      this.project_id = projectId;
      if (!config.otelInstrumentated) {
        const loggerLevel = config.debug
          ? DiagLogLevel.DEBUG
          : DiagLogLevel.NONE;
        diag.setLogger(new DiagConsoleLogger(), loggerLevel);

        const defaultAttributes = {
          [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName,
          [SemanticResourceAttributes.SERVICE_VERSION]:
            config.serviceVersion || "1.0.0",
          environment: "production",
          "at-project-id": projectId,
          "at-api-key": apiKey,
        };

        const resource = new Resource(defaultAttributes);

        const logExporter = new OTLPLogExporter({
          url: "http://localhost:4317", //grpc endpoint
        });

        const traceExporter = new OTLPTraceExporter({
          url: "http://localhost:4317", // grpc endpoint
        });
        const httpInst = new HttpInstrumentation({
          requestHook: (span, request: ClientRequest | IncomingMessage) => {
            this.updateCurrentSpan(span);
          },
        });
        const sdk = new NodeSDK({
          instrumentations: [httpInst],
          resource: resource,
          logRecordProcessors: [new logs.SimpleLogRecordProcessor(logExporter)],
          traceExporter,
        });
        this.otelSDk = sdk;
        sdk.start();
      }
    }
    this.expressMiddleware = this.expressMiddleware.bind(this);
    this.updateCurrentSpan = this.updateCurrentSpan.bind(this);
  }

  private updateCurrentSpan(span: Span) {
    this.currentSpan?.push(span);
  }

  public handleHTTPRequestSpan(span: Span) {
    this.updateCurrentSpan(span);
  }

  public expressMiddleware(req: Request, res: Response, next: NextFunction) {
    if (this.project_id === undefined) {
      console.log(
        "APIToolkit: expressMiddleware called, but apitoolkit was not correctly setup. Doing nothing."
      );
      next();
      return;
    }
    let span;
    if (this.tracer) {
      span = this.tracer.startSpan("HTTP");
    } else {
      span = this.currentSpan?.shift();
      // default Http auto instrumentation doesn't get reported otherwise
      const tracer = trace.getTracer(this.config.serviceName);
      const sp = tracer.startSpan("express-request");
      sp.end();
    }

    if (this.config?.debug) {
      console.log("APIToolkit: expressMiddleware called");
    }

    let respBody: any = "";
    const oldSend = res.send;
    res.send = (val) => {
      respBody = val;
      return oldSend.apply(res, [val]);
    };

    const onRespFinished = (req: Request, res: Response) => () => {
      res.removeListener("close", onRespFinished(req, res));
      res.removeListener("error", onRespFinished(req, res));
      res.removeListener("finish", onRespFinished(req, res));
      try {
        let url_path = req.route?.path || "";

        const ignoredRoute =
          this.config.ignoreEndpoints?.some((e) => {
            const endpoint = req.method + url_path;
            return endpoint
              .toLowerCase()
              .endsWith(e.replace(" ", "").toLowerCase());
          }) || false;

        if (ignoredRoute) {
          if (this.config?.debug) {
            console.log(
              "APIToolkit: ignored endpoint=>",
              `${req.method} ${url_path}`
            );
          }
          return;
        }

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
          } catch {
            reqBody = String(req.body);
          }
        }
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
          if (url_path !== "") {
            span.updateName(`${req.method} ${url_path}`);
          }
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
          span.setAttribute("http.apt.sdk_type", "JsExpress");
          const reqHeaders = Object.entries(req.headers);

          reqHeaders.forEach(([header, value]) => {
            const isRedacted = this.config.redactHeaders?.some(
              (h) =>
                h.toLowerCase() === header.toLowerCase() ||
                ["cookie", "authorization"].includes(h.toLowerCase())
            );
            const headerVal = isRedacted ? "[CLIENT_REDACTED]" : String(value);
            span.setAttribute("http.request.header." + header, headerVal);
          });
          const resHeaders = Object.entries(res.getHeaders());
          resHeaders.forEach(([header, value]) => {
            const isRedacted = this.config.redactHeaders?.some(
              (h) =>
                h.toLowerCase() === header.toLowerCase() ||
                ["cookie", "authorization"].includes(h.toLowerCase())
            );
            const headerVal = isRedacted ? "[CLIENT_REDACTED]" : String(value);
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
  }

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
