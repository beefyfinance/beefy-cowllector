import { rootLogger } from './logger';

const logger = rootLogger.child({ module: 'process' });

type ExitCallback = () => Promise<any>;
const exitCallbacks: ExitCallback[] = [];

let called = false;
async function exitHandler() {
    if (called) {
        return;
    }
    called = true;
    try {
        await Promise.allSettled(exitCallbacks.map(cb => cb()));
        logger.info('All exit handlers done. Bye.');
        process.exit(0);
    } catch (e) {
        logger.error(`Exit handlers didn't work properly`);
        logger.error(e);
        process.exit(1);
    }
}

process.on('SIGTERM', exitHandler);
process.on('SIGINT', exitHandler);

export async function runMain(main: () => Promise<any>, onExit?: () => void) {
    try {
        await main();
        if (onExit) {
            onExit();
        }
        await exitHandler();
        logger.info('Done');
        process.exit(0);
    } catch (e) {
        logger.error('ERROR');
        logger.error(e);
        if (onExit) {
            onExit();
        }
        await exitHandler();
        process.exit(1);
    }
}
