interface QueueTask {
  enqueuedAt: number;
  run: (queueTimeMs: number) => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}

export class ExecutionQueue {
  private readonly pending: QueueTask[] = [];
  private activeCount = 0;

  constructor(
    private readonly concurrency: number,
    private readonly depthLimit: number,
  ) {}

  getConcurrency() {
    return this.concurrency;
  }

  getDepthLimit() {
    return this.depthLimit;
  }

  getDepth() {
    return this.pending.length;
  }

  async enqueue<T>(run: (queueTimeMs: number) => Promise<T>): Promise<T> {
    if (this.pending.length >= this.depthLimit) {
      throw new Error(
        "Execution queue is full. Please wait a moment and try again.",
      );
    }

    return new Promise<T>((resolve, reject) => {
      this.pending.push({
        enqueuedAt: Date.now(),
        run,
        resolve: (value) => resolve(value as T),
        reject,
      });
      this.drain();
    });
  }

  private drain() {
    while (this.activeCount < this.concurrency && this.pending.length > 0) {
      const task = this.pending.shift();

      if (!task) {
        return;
      }

      this.activeCount += 1;
      void task
        .run(Date.now() - task.enqueuedAt)
        .then(task.resolve)
        .catch(task.reject)
        .finally(() => {
          this.activeCount -= 1;
          this.drain();
        });
    }
  }
}
