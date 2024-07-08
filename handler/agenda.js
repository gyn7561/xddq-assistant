import schedule from "node-schedule";
import logger from "../utils/logger.js";
import { TaskManager } from "../modules/tasks.js";
import { Homeland } from "./homeland.js";
import { AttributeManager } from "./attribute.js";

function agenda() {
    callbackHomeland();
    AttributeManager.instance.doChopTree()
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

export default agenda;
