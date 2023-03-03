"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.Logger = void 0;
/**
Singleton class to facilitate flexible and coherent console logging within a
multi-faceted service, building on the common "loglevel" NPM package. Provides
additionally and alongside a rules-based back-ending of the console logging
with the Sentry service to facilitate remote monitoring (WIP).

Usage:
+ In whatever module you need logging, import the singleton main loglevel
    instance by the import:
import { logger } from '../yourpath/logger'
+ In the application entry-point module, also import the main `Logger` class so
you may adjust the default configuration, like (1) setting a default logging
level, e.g.
Logger.instance.setDefaultLevel( Logger.levels.WARN)
to decrease verbosity from the default of
Logger.levels.INFO
or (2) setting up a central Sentry integration
Logger.instance.initializeSentry( {dsn: <your DSN URL>, tracesSampleRate: 1.0})
+ Wherever a specialized, separately configurable logger is desired, it can be
obtained via a call against the main logger instance:
logger.getLogger( 'YourName')
In practice, I tend to just make this call right after the import section of a
module of insterest, at module scope, so the logger can be used freely
throughout:
const _logger = logger.getLogger( 'YourName');
+ You may specify the verbosity of a specialized logger in advance, like in
your entry-point module, from the main logging instance, like so:
logger.setLevel( 'yourSublogName', Logger.levels.DEBUG)
This way, your main module may centrally manage the logging over the system.
**/
const loglevel_1 = __importDefault(require("loglevel"));
const Sentry = __importStar(require("@sentry/node"));
const loglevel_sentry_1 = __importDefault(require("@toruslabs/loglevel-sentry"));
const baseNode_1 = require("../utility/baseNode");
class Logger {
    constructor() {
        // private readonly _sentry = new LoglevelSentryPlugin( Sentry);
        this._sentryLogger = false;
        this._children = {};
    }
    static get instance() {
        return this._singleton;
    }
    static subLoggerSet(test) {
        return test instanceof Object;
    }
    setLevel(name, level) {
        let entry;
        if ('main' === name.toLowerCase())
            Logger._mainLog.setLevel(level, false);
        else if (Logger.subLoggerSet(entry = this._children[name]))
            entry.setLevel(level);
        else {
            this._children[name] = level;
            return false;
        }
        return true;
    } //setLevel(
    setDefaultLevel(level) {
        Logger._mainLog.setDefaultLevel(level);
    }
    initializeSentry(initializer) {
        Sentry.init(initializer);
        this._sentryLogger = true;
    }
    get name() {
        return Logger._mainLog.name;
    }
    info(msg) {
        Logger._mainLog.info(msg);
        this.sentry(loglevel_1.default.levels.INFO, msg);
    }
    warn(msg) {
        Logger._mainLog.warn(msg);
        this.sentry(loglevel_1.default.levels.WARN, msg);
    }
    error(msg) {
        Logger._mainLog.error(msg);
        this.sentry(loglevel_1.default.levels.ERROR, msg);
    }
    debug(msg) {
        Logger._mainLog.debug(msg);
        this.sentry(loglevel_1.default.levels.DEBUG, msg);
    }
    trace(msg) {
        Logger._mainLog.trace(msg);
        this.sentry(loglevel_1.default.levels.TRACE, msg);
    }
    get sentryLogger() {
        if (!this._sentryLogger)
            return null;
        //if not yet completed, set up the Sentry logger, restricting its output to 
        //	Sentry alone (nothing redundant to console) and with a default of 
        //	emitting only errors (or worse)
        if ('boolean' == typeof this._sentryLogger) {
            this._sentryLogger = loglevel_1.default.getLogger('Beefy Sentry');
            this._sentryLogger.methodFactory = () => () => void (0);
            (new loglevel_sentry_1.default(Sentry)).install(this._sentryLogger);
            this._sentryLogger.setLevel(loglevel_1.default.levels.ERROR);
        }
        return this._sentryLogger;
    } //get sentryLogger() : ILogger | null
    sentry(level, msg) {
        if (!this.sentryLogger)
            return;
        if (loglevel_1.default.levels.ERROR <= level) {
            //TODO: figure out the TS to get rid of the ugly "any" cast
            this.sentryLogger[Logger.levelNames[level].toLowerCase()](`${Logger.levelNames[level]}: ${msg}`);
            return;
        }
        //if the situation matches a rule set for Sentry output, send the message 
        //  to Sentry
    } //private sentry(
    getLogger(name) {
        let entry = this._children[name];
        if (!(Logger.subLoggerSet(entry))) {
            const subLogger = this._children[name] = new Logger.SubLogger(name, this);
            if ('undefined' !== typeof entry)
                subLogger.setLevel(entry);
            entry = subLogger;
        }
        return entry;
    } //public getLogger(
} //class Logger
exports.Logger = Logger;
Logger.levels = loglevel_1.default.levels;
Logger.levelNames = (0, baseNode_1.swapKeyValues)(Logger.levels);
Logger._singleton = new Logger();
Logger._mainLog = loglevel_1.default;
Logger.SubLogger = class {
    constructor(name, parent) {
        this.name = name;
        this.parent = parent;
        this._logger = Logger._mainLog.getLogger(name);
    }
    setLevel(level, persist) {
        this._logger.setLevel(level, persist);
    }
    info(msg) {
        const niceifiedMessage = this.niceifyOutput(msg);
        this._logger.info(niceifiedMessage);
        this.parent.sentry(loglevel_1.default.levels.INFO, niceifiedMessage);
    }
    warn(msg) {
        const niceifiedMessage = this.niceifyOutput(msg);
        this._logger.warn(niceifiedMessage);
        this.parent.sentry(loglevel_1.default.levels.WARN, niceifiedMessage);
    }
    error(msg) {
        const niceifiedMessage = this.niceifyOutput(msg);
        this._logger.error(niceifiedMessage);
        this.parent.sentry(loglevel_1.default.levels.ERROR, niceifiedMessage);
    }
    debug(msg) {
        const niceifiedMessage = this.niceifyOutput(msg);
        this._logger.debug(niceifiedMessage);
        this.parent.sentry(loglevel_1.default.levels.DEBUG, niceifiedMessage);
    }
    trace(msg) {
        const niceifiedMessage = this.niceifyOutput(msg);
        this._logger.trace(niceifiedMessage);
        this.parent.sentry(loglevel_1.default.levels.TRACE, niceifiedMessage);
    }
    niceifyOutput(message) {
        const indexPrecedingWhitespace = message.search(/\S|$/);
        return `${message.slice(0, indexPrecedingWhitespace)}${this.name}: ${message.slice(indexPrecedingWhitespace)}`;
    }
}; //static SubLogger = class implements ILogger
Logger.instance.setDefaultLevel(Logger.levels.INFO);
exports.logger = Logger.instance;
