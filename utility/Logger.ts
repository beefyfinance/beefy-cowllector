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
import loglevel from 'loglevel';
import * as Sentry from '@sentry/node';
//import {RewriteFrames} from '@sentry/integrations';
import type { NodeOptions } from '@sentry/node/types/types';
import LoglevelSentryPlugin from '@toruslabs/loglevel-sentry';
import { swapKeyValues } from '../utility/baseNode';

type NamedRootLog = loglevel.RootLogger & { name: string | undefined };
type NamedLog = loglevel.Logger & { name: string };

export class Logger implements ILogger {
  public static readonly levels: loglevel.LogLevel = loglevel.levels;
  public static readonly levelNames: Readonly<Record<string, string>> = swapKeyValues(
    <Partial<loglevel.LogLevel>>Logger.levels
  );

  private static readonly _singleton: Logger = new Logger();
  private static readonly _mainLog = <NamedRootLog>(<unknown>loglevel);

  public static get instance(): Logger {
    return this._singleton;
  }

  private static subLoggerSet(
    test: InstanceType<typeof Logger.SubLogger> | loglevel.LogLevelDesc
  ): test is InstanceType<typeof Logger.SubLogger> {
    return test instanceof Object;
  }

  // private readonly _sentry = new LoglevelSentryPlugin( Sentry);
  private _sentryLogger: NamedLog | boolean = false;
  private _children = {} as Record<
    string,
    InstanceType<typeof Logger.SubLogger> | loglevel.LogLevelDesc
  >;

  private constructor() {}

  public setLevel(name: string, level: loglevel.LogLevelDesc): boolean {
    let entry: InstanceType<typeof Logger.SubLogger> | loglevel.LogLevelDesc;
    if ('main' === name.toLowerCase()) Logger._mainLog.setLevel(level, false);
    else if (Logger.subLoggerSet((entry = this._children[name]))) entry.setLevel(level);
    else {
      this._children[name] = level;
      return false;
    }
    return true;
  } //setLevel(

  public setDefaultLevel(level: loglevel.LogLevelDesc): void {
    Logger._mainLog.setDefaultLevel(level);
  }

  public initializeSentry(initializer: Readonly<NodeOptions>): void {
    Sentry.init(initializer);
    this._sentryLogger = true;
  }

  public get name() {
    return Logger._mainLog.name;
  }

  public info(msg: string): void {
    Logger._mainLog.info(msg);
    this.sentry(loglevel.levels.INFO, msg);
  }

  public warn(msg: string): void {
    Logger._mainLog.warn(msg);
    this.sentry(loglevel.levels.WARN, msg);
  }

  public error(msg: string): void {
    Logger._mainLog.error(msg);
    this.sentry(loglevel.levels.ERROR, msg);
  }

  public debug(msg: string): void {
    Logger._mainLog.debug(msg);
    this.sentry(loglevel.levels.DEBUG, msg);
  }

  public trace(msg: string): void {
    Logger._mainLog.trace(msg);
    this.sentry(loglevel.levels.TRACE, msg);
  }

  public get sentryLogger(): ILogger | null {
    if (!this._sentryLogger) return null;

    //if not yet completed, set up the Sentry logger, restricting its output to
    //	Sentry alone (nothing redundant to console) and with a default of
    //	emitting only errors (or worse)
    if ('boolean' == typeof this._sentryLogger) {
      this._sentryLogger = <NamedLog>loglevel.getLogger('Beefy Sentry');
      this._sentryLogger.methodFactory = () => () => void 0;
      new LoglevelSentryPlugin(Sentry).install(this._sentryLogger);
      this._sentryLogger.setLevel(loglevel.levels.ERROR);
    }

    return this._sentryLogger;
  } //get sentryLogger() : ILogger | null

  private sentry(level: loglevel.LogLevelNumbers, msg: string): void {
    if (!this.sentryLogger) return;

    if (loglevel.levels.ERROR <= level) {
      //TODO: figure out the TS to get rid of the ugly "any" cast
      (<any>this.sentryLogger)[Logger.levelNames[level].toLowerCase()](
        `${Logger.levelNames[level]}: ${msg}`
      );
      return;
    }

    //if the situation matches a rule set for Sentry output, send the message
    //  to Sentry
  } //private sentry(

  public getLogger(name: string): ILogger {
    let entry: InstanceType<typeof Logger.SubLogger> | loglevel.LogLevelDesc | undefined =
      this._children[name];
    if (!Logger.subLoggerSet(entry)) {
      const subLogger = (this._children[name] = new Logger.SubLogger(name, this));
      if ('undefined' !== typeof entry) subLogger.setLevel(entry);
      entry = subLogger;
    }
    return entry;
  } //public getLogger(

  protected static SubLogger = class implements ILogger {
    private _logger: NamedLog;
    constructor(readonly name: string, private parent: Logger) {
      this._logger = <NamedLog>Logger._mainLog.getLogger(name);
    }

    public setLevel(level: loglevel.LogLevelDesc, persist?: boolean): void {
      this._logger.setLevel(level, persist);
    }

    public info(msg: string): void {
      const niceifiedMessage = this.niceifyOutput(msg);
      this._logger.info(niceifiedMessage);
      this.parent.sentry(loglevel.levels.INFO, niceifiedMessage);
    }

    public warn(msg: string): void {
      const niceifiedMessage = this.niceifyOutput(msg);
      this._logger.warn(niceifiedMessage);
      this.parent.sentry(loglevel.levels.WARN, niceifiedMessage);
    }

    public error(msg: string): void {
      const niceifiedMessage = this.niceifyOutput(msg);
      this._logger.error(niceifiedMessage);
      this.parent.sentry(loglevel.levels.ERROR, niceifiedMessage);
    }

    public debug(msg: string): void {
      const niceifiedMessage = this.niceifyOutput(msg);
      this._logger.debug(niceifiedMessage);
      this.parent.sentry(loglevel.levels.DEBUG, niceifiedMessage);
    }

    public trace(msg: string): void {
      const niceifiedMessage = this.niceifyOutput(msg);
      this._logger.trace(niceifiedMessage);
      this.parent.sentry(loglevel.levels.TRACE, niceifiedMessage);
    }

    private niceifyOutput(message: string): string {
      const indexPrecedingWhitespace = message.search(/\S|$/);
      return `${message.slice(0, indexPrecedingWhitespace)}${this.name}: ${message.slice(
        indexPrecedingWhitespace
      )}`;
    }
  }; //static SubLogger = class implements ILogger
} //class Logger

Logger.instance.setDefaultLevel(Logger.levels.INFO);
export const logger: Logger = Logger.instance;

export interface ILogger {
  readonly name: string | undefined;
  info(msg: string): void; //TODO: extend these to handle concatenated ...args
  warn(msg: string): void;
  error(msg: string): void;
  debug(msg: string): void;
  trace(msg: string): void;
}
