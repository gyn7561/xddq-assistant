import schedule from 'node-schedule';
import logger from "../utils/logger.js";
import { TaskManager, ImmediateTask } from "../modules/tasks.js";

function Frog(i) {
    return new ImmediateTask(`Frog${i}`, 20211, { isUseADTime: false });
}

function handlerFrog(body) {
    const remainingTimes = 6 - body.getAdRewardTimes;
    const intervalInMinutes = 5; // 设置时间间隔，单位为分钟

    if (remainingTimes > 0) {
        logger.info(`[Frog] 还有${remainingTimes}次小青蛙奖励`);
        for (let i = 0; i < remainingTimes; i++) {
            const jobTime = new Date(Date.now() + i * intervalInMinutes * 60 * 1000);
            schedule.scheduleJob(jobTime, () => {
                logger.info(`[Server] [还有${remainingTimes - 1 - i}次小青蛙奖励] 领取小青蛙`);
                TaskManager.instance.add(Frog(i));
            });
        }
    }
}

export { handlerFrog };