// 自定义 Worker 入口，支持 Cron Triggers
import worker from "./.open-next/worker.js";

export * from "./.open-next/worker.js";

export default {
  // 处理 HTTP 请求（委托给 OpenNext）
  fetch: worker.fetch,

  // 处理 Cron Triggers
  async scheduled(event: ScheduledEvent, env: CloudflareEnv, ctx: ExecutionContext) {
    // 根据 cron 表达式判断类型
    const hour = new Date(event.scheduledTime).getUTCHours();

    // UTC 12:00 = 北京时间 20:00，更新基金
    // UTC 1-7 = 北京时间 9-15，更新股票
    const type = hour === 12 ? "fund" : "stock";

    // 构造内部请求，直接调用 worker.fetch
    const request = new Request(
      `https://localhost/api/cron/update-prices?type=${type}`,
      { method: "GET" }
    );

    ctx.waitUntil(
      worker.fetch(request, env, ctx).then((res: Response) => {
        console.log(`Cron ${type} update: ${res.status}`);
      }).catch((err: Error) => {
        console.error(`Cron ${type} error:`, err);
      })
    );
  },
};
