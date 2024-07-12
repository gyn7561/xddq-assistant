import logger from "../utils/logger.js";
import { TaskManager, ImmediateTask, CountedTask } from "../modules/tasks.js";

class Pupil {
    // 宗门信息 统计专用
    static S_ENTER_PUPIL_SYSTEM() {
        return new ImmediateTask("S_ENTER_PUPIL_SYSTEM", 211801, {});
    }

    // 宗门出师
    static S_PUPIL_GRADUATE(id) {
        return new ImmediateTask(`S_PUPIL_GRADUATE${id}`, 211806, { siteIndex: id });
    }

    // 宗门招人
    static S_PUPIL_INVITATION(count) {
        return new CountedTask("S_PUPIL_INVITATION", 211805, {}, 1000, count);
    }
}

function countElementsWithoutPupilData(siteList) {
    return siteList.filter((site) => !site.hasOwnProperty("pupilData")).length;
}

function getGraduationIndices(siteList) {
    return siteList
        .filter((site) => site.pupilData && site.trainTimeInfo && site.pupilData.level * 20 <= site.trainTimeInfo.trainTimes)
        .map((site) => site.index);
}

function handlerPupil(body) {
    if (body.ret === 0) {
        // 判断是否可以招人
        const invitationCount = countElementsWithoutPupilData(body.siteList);
        if (invitationCount > 0) {
            logger.info(`[宗门] 招 ${invitationCount} 人`);
            TaskManager.instance.add(Pupil.S_PUPIL_INVITATION(invitationCount));
        }

        // 判断是否可以出师
        const graduationIndices = getGraduationIndices(body.siteList);
        if (graduationIndices.length > 0) {
            logger.info(`[宗门] 出师 ${graduationIndices.length} 人`);
            graduationIndices.forEach((index) => TaskManager.instance.add(Pupil.S_PUPIL_GRADUATE(index)));
            TaskManager.instance.add(Pupil.S_PUPIL_INVITATION(graduationIndices.length));
        }
    }
}

export { Pupil, handlerPupil };
