"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.APIToolkit = exports.ReportError = exports.asyncLocalStorage = exports.APIToolkitAsync = void 0;
const apitoolkit_async_1 = __importDefault(require("./apitoolkit-async"));
var apitoolkit_async_2 = require("./apitoolkit-async");
Object.defineProperty(exports, "APIToolkitAsync", { enumerable: true, get: function () { return apitoolkit_async_2.APIToolkitAsync; } });
Object.defineProperty(exports, "asyncLocalStorage", { enumerable: true, get: function () { return apitoolkit_async_2.asyncLocalStorage; } });
Object.defineProperty(exports, "ReportError", { enumerable: true, get: function () { return apitoolkit_async_2.ReportError; } });
exports.default = apitoolkit_async_1.default;
var apitoolkit_1 = require("./apitoolkit");
Object.defineProperty(exports, "APIToolkit", { enumerable: true, get: function () { return apitoolkit_1.APIToolkit; } });
