// backend/src/modules/auth/strategies/local.strategy.ts
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-local";
import { AuthService } from "../auth.service";
import { LoginDto } from "../dto/login.dto";

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, "local") {
  constructor(private readonly authService: AuthService) {
    super({
      usernameField: "identifier",
      passwordField: "password",
    });
  }

  async validate(identifier: string, password: string): Promise<any> {
    const loginDto: LoginDto = { identifier, password };
    const user = await this.authService.validateUser(loginDto);
    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }
    return user;
  }
}
