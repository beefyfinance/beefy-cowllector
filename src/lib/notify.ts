import axios from 'axios';
import { HarvestReport, serializeReport } from './harvest-report';
import { DISCORD_WEBHOOK_URL } from '../util/config';
import { rootLogger } from '../util/logger';
import { Blob, File } from 'buffer';

const logger = rootLogger.child({ module: 'notify' });

type DiscordWebhookParams = {
    content: string;
    username?: string;
    avatar_url?: string;
};

const CONTENT_TEMPLATE = `
- chain: {r.chain}
- totalProfitWei: {r.summary.totalProfitWei}
- totalStrategies: {r.summary.totalStrategies}
- harvested: {r.summary.harvested}
- skipped: {r.summary.skipped}
- errors: {r.summary.errors}
`;

export async function notifyReport(report: HarvestReport) {
    if (!DISCORD_WEBHOOK_URL) {
        logger.warn({ msg: 'DISCORD_WEBHOOK_URL not set, not sending any discord message' });
        return;
    }

    if (report.summary.harvested === 0 && report.summary.errors === 0) {
        logger.info({ msg: 'All strats were skipped, not reporting', data: report.summary });
        return;
    }

    logger.info({ msg: 'notifying harvest for report', data: { chain: report.chain } });
    const params: DiscordWebhookParams = {
        content: CONTENT_TEMPLATE.replace('{r.chain}', report.chain)
            .replace('{r.summary.totalProfitWei}', report.summary.totalProfitWei.toString())
            .replace('{r.summary.totalStrategies}', report.summary.totalStrategies.toString())
            .replace('{r.summary.harvested}', report.summary.harvested.toString())
            .replace('{r.summary.skipped}', report.summary.skipped.toString())
            .replace('{r.summary.errors}', report.summary.errors.toString()),
    };

    try {
        const reportStr = serializeReport(report, true);
        const reportBlob = new Blob([reportStr], { type: 'application/json' });
        const reportFile = new File([reportBlob], `report_${report.chain}.json`);

        const form = new FormData();
        form.append('payload_json', JSON.stringify(params));
        form.append('file1', reportFile as any);

        await axios.post(DISCORD_WEBHOOK_URL, form);
    } catch (e) {
        logger.error({ msg: 'something went wrong sending discord message', data: { e } });
        logger.trace(e);
    }
}
