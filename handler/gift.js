import logger from "../utils/logger.js";
import { TaskManager, Task } from "../modules/tasks.js";

function Gift(id) {
    return new Task(
        `Gift${id}`,
        24807,
        {
            id: id,
            getReward: true,
            type: "SendGiftType_Palace",
        },
        0
    ); // 仙友游历
}

function handlerGift(body) {
    for (let i = 0; i < body.data.length; i++) {
        const id = body.data[i].id;
        logger.info(`[Server] 收获礼物 ${id}`);
        TaskManager.instance.add(Gift(id));
    }
}

export { handlerGift };
