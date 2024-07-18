import logger from "../utils/logger.js";
import { TaskManager, RepeatedTask } from "../modules/tasks.js";

function Destiny() {
    return new RepeatedTask("Destiny", 20653, { isOneKey: true }, 60 * 1000 * 30) // 30分钟来一次仙友游历
}

function handlerDestiny(body) {
    const power = body.playerDestinyDataMsg.power;
    if (power > 0) {
        logger.info(`[Server] [仙友游历] [Power: ${power}] 一键游历`);
        TaskManager.instance.add(Destiny());
    } else {
        //半小时会恢复体力，半小时后添加任务 
        setTimeout(() => {
            TaskManager.instance.add(Destiny());
        }, 60 * 1000 * 30);
    }
}

export { handlerDestiny };