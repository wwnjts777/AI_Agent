import { Global, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthGuard } from "./auth.guard";

@Global()
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET ?? "dev-secret",
      signOptions: { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? "8h" }
    })
  ],
  providers: [AuthGuard],
  exports: [JwtModule, AuthGuard]
})
export class CommonAuthModule {}
