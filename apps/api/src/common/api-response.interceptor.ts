import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { map, Observable } from "rxjs";

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ id?: string }>();
    return next.handle().pipe(
      map((data) => {
        if (data?.__raw) return data.payload;
        return {
          success: true,
          data,
          meta: { requestId: request.id ?? null }
        };
      })
    );
  }
}
