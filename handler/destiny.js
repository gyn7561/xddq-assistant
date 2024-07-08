import logger from "../utils/logger.js";
import { TaskManager, Task } from "../modules/tasks.js";

function Destiny() {
    return new Task("Destiny", 20653, { isOneKey: true }, 0) // 仙友游历
}

function handlerDestiny(body) {
    const power = body.playerDestinyDataMsg.power;
    if (power > 0) {
        logger.info(`[Server] [仙友游历] [Power: ${power}] 一键游历`);
        TaskManager.instance.add(Destiny());
    }
}

export { handlerDestiny };