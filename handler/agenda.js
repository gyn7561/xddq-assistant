import logger from "../utils/logger.js";
import { TaskManager } from "../modules/tasks.js";
import { Attribute, AttributeManager } from "./attribute.js";

function agenda() {
    AttributeManager.instance.doChopTree();
    consumBag();
}

function consumBag() {
    async function checkBag() {
        // 斗法券 > 0 的时候自动斗法
        const fightTicket = AttributeManager.instance.findItemById(100026);
        if (fightTicket.num > 0) {
            logger.info(`还剩 ${fightTicket.num} 张券`);
            await TaskManager.instance.add(Attribute.FetchBattle());
            await new Promise(resolve => setTimeout(resolve, 1000));
            await TaskManager.instance.add(Attribute.Battle());
        }

        // 万年灵芝 > 0 的时候自动激活
        const books = AttributeManager.instance.findItemById(100008);
        if (books.num > 0) {
            logger.info(`还剩 ${books.num} 万年灵芝`);
            await TaskManager.instance.add(Attribute.ReadBooks(books.num));
        }
        setTimeout(checkBag, 30000);
    }
    checkBag();
}

export default agenda;
