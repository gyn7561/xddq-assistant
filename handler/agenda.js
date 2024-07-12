import logger from "../utils/logger.js";
import { TaskManager } from "../modules/tasks.js";
import { Attribute, AttributeManager } from "./attribute.js";
import { Herorank } from "./herorank.js";
import account from "../account.js";

function agenda() {
    AttributeManager.instance.doChopTree();
    // AttributeManager.instance.doTalentReq();
    consumBag();

    // 光速抢镑任务在周一0:05分开始执行
    const now = new Date();
    const delay =
        7 * 24 * 60 * 60 * 1000 -
        (now.getDay() * 24 * 60 * 60 * 1000 + now.getHours() * 60 * 60 * 1000 + now.getMinutes() * 60 * 1000 + now.getSeconds() * 1000 + now.getMilliseconds());
    
    if (account.switch.herorank) {
        setTimeout(() => {
            logger.info("[群英镑] 光速抢榜一");
            TaskManager.instance.add(Herorank.S_HERORANK_BUY_ENERGY());
            TaskManager.instance.add(Herorank.S_HERORANK_GET_FIGHT_LIST());
        }, delay);
    }
}

function consumBag() {
    async function checkBag() {
        // 斗法券 > 0 的时候自动斗法
        const fightTicket = AttributeManager.instance.findItemById(100026);
        if (fightTicket.num > 0) {
            logger.info(`还剩 ${fightTicket.num} 张券`);
            await TaskManager.instance.add(Attribute.FetchBattle());
            await new Promise((resolve) => setTimeout(resolve, 1000));
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
