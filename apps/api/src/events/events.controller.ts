import { Controller, Sse, UseGuards } from "@nestjs/common";
import { map } from "rxjs";
import { AuthGuard } from "../common/auth.guard";
import { EventsService } from "./events.service";

@Controller("events")
@UseGuards(AuthGuard)
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Sse("stream")
  stream() {
    return this.eventsService.events().pipe(
      map((event) => ({
        data: event
      }))
    );
  }
}
