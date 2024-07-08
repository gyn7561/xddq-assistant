import schedule from "node-schedule";
import logger from "../utils/logger.js";
import { TaskManager } from "../modules/tasks.js";
import { Homeland } from "./homeland.js";
import { Attribute, AttributeManager } from "./attribute.js";

function agenda() {
    callbackHomeland();
    AttributeManager.instance.doChopTree()
    consumBag()
}

function callbackHomeland() {
    const rule = new schedule.RecurrenceRule();
    rule.hour = 22;
    rule.minute = 0;
    rule.second = 0;

    schedule.scheduleJob(rule, () => {
        logger.info(`[Agenda] 每天 22:00:00 召回异常老鼠`);
        TaskManager.instance.add(Homeland.Manage(0));
    });
}

function consumBag() {
    schedule.scheduleJob('*/30 * * * * *', function() {
        // 斗法券 > 0 的时候自动斗法
        const fightTicket = AttributeManager.instance.findItemById(100026);
        if (fightTicket.num > 0) {
            logger.info(`还剩 ${fightTicket.num} 张券`);
            TaskManager.instance.add(Attribute.FetchBattle());
            new Promise(resolve => setTimeout(resolve, 1000));
            TaskManager.instance.add(Attribute.Battle());
        }

        // 万年灵芝 > 0 的时候自动激活
        const books = AttributeManager.instance.findItemById(100008);
        if (books.num > 0) {
            logger.info(`还剩 ${books.num} 万年灵芝`);
            TaskManager.instance.add(Attribute.ReadBooks(books.num));
        }
    }); 
}

export default agenda;
