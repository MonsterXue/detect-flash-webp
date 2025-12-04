let taskId = 1;

/**
* @param {string} max 并发数
* @param {function} onComplete
*/
class TaskQueue {
    constructor(ctor) {
        this.max = ctor?.max || 1;
        this.queue = [];
        this.runningCount = 0;
        this.onComplete = ctor?.onComplete;
        this.completed = false;
    }
    add(cb) {
        this.queue.push({
            id: taskId++,
            cb,
        });
        this.completed = false;
    }
    delete(id) {
        const findIndex = this.queue.findIndex((item) => item.id === id);
        if (findIndex === -1) return;
        this.queue.splice(findIndex, 1);
    }
    run() {
        while (this.runningCount < this.max && this.queue.length) {
            const task = this.queue.shift();
            this.runningCount++;
            const result = task.cb();
            if (result && typeof result.finally === 'function') {
                result.finally(() => {
                    this.runningCount--;
                    this.run();
                    this._checkComplete();
                });
            } else {
                this.runningCount--;
                this.run();
                this._checkComplete();
            }
        }
        this._checkComplete();
    }
    _checkComplete() {
        if (!this.queue.length && !this.runningCount && !this.completed) {
            this.completed = true;
            this.onComplete?.();
        }
    }
}

module.exports = TaskQueue
