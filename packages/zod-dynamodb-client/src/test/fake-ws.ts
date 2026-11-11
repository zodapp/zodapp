import type { WebSocketLike } from "../connection";

/** 差し替えの WebSocket。テストからサーバー側の振る舞いを決める */
export class FakeWebSocket implements WebSocketLike {
  static instances: FakeWebSocket[] = [];
  static get last() {
    return FakeWebSocket.instances.at(-1)!;
  }
  readyState = 0;
  sent: Record<string, any>[] = [];
  closed = false;
  onopen: ((event: unknown) => void) | null = null;
  onclose: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.closed = true;
    this.readyState = 3;
  }
  // ---- サーバー側 ----
  open() {
    this.readyState = 1;
    this.onopen?.({});
  }
  receive(message: Record<string, unknown>) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
  drop() {
    this.readyState = 3;
    this.onclose?.({});
  }
  /** 最後に送られた、その種類のメッセージ */
  lastSent(type: string) {
    return this.sent.filter((m) => m.type === type).at(-1)!;
  }
}

export const flush = () => new Promise((r) => setTimeout(r, 0));
