import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { Subject } from "rxjs";

export type HubEvent = {
  id: string;
  type: "message.created" | "message.updated" | "chat.updated" | "bot.status";
  payload: unknown;
  createdAt: string;
};

@Injectable()
export class EventsService {
  private readonly stream = new Subject<HubEvent>();

  emit(type: HubEvent["type"], payload: unknown) {
    this.stream.next({
      id: randomUUID(),
      type,
      payload,
      createdAt: new Date().toISOString()
    });
  }

  events() {
    return this.stream.asObservable();
  }
}
