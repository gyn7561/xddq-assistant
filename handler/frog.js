import logger from "../utils/logger.js";
import { TaskManager, CountedTask } from "../modules/tasks.js";

function Frog(interval, count) {
    return new CountedTask("Frog", 20211, { isUseADTime: false }, interval, count);
}

function handlerFrog(body) {
    const remainingTimes = 5 - body.getAdRewardTimes;
    const intervalInMinutes = 5 * 60 * 1000; // 设置时间间隔，单位为分钟

    if (remainingTimes > 0) {
        logger.info(`[Frog] 还有${remainingTimes}次小青蛙奖励`);
        TaskManager.instance.add(Frog(intervalInMinutes, remainingTimes));
    }
}

export { handlerFrog };