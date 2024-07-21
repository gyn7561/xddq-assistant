class LoopMgr {
    constructor() {
        this.intervalTimeId = null;
        this.nextDayTime = 0;
        this.list = [];
    }

    static get inst() {
        if (!this._instance) {
            this._instance = new LoopMgr();
        }
        return this._instance;
    }

    start() {
        this.end();
        this.intervalTimeId = setInterval(() => {
            this.loopUpdate();
        }, 1000);
    }

    end() {
        clearInterval(this.intervalTimeId);
    }

    add(loopable) {
        if (this.list.indexOf(loopable) === -1) {
            this.list.push(loopable);
        }
    }

    remove(loopable) {
        const index = this.list.indexOf(loopable);
        if (index !== -1) {
            this.list.splice(index, 1);
        }
    }

    loopUpdate() {
        const now = Math.floor(Date.now() / 1000);
        this.list.forEach(item => {
            if (item && typeof item.loopUpdate === 'function') {
                item.loopUpdate();
            }
        });

        if (this.nextDayTime && now > this.nextDayTime) {
            this.refreshNextDayTime();
        }
    }

    refreshNextDayTime() {
        this.nextDayTime = this.getCurZeroTime() + 86400;
    }

    getCurZeroTime() {
        const utcOffset = 8; // 东八区
        const now = new Date();
    
        const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
        const localTime = new Date(utcTime + (utcOffset * 3600000));
    
        localTime.setHours(0, 0, 0, 0);
    
        return localTime.getTime() / 1000;
    }

    resumeLoginIn() {
        this.loopUpdate();
    }
}

export default LoopMgr;