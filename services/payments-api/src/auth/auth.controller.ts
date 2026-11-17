import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiProperty, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import type { AccessToken } from './auth.service';

export class LoginDto {
  @ApiProperty({ example: 'demo@payflow.dev' })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: 'demo-password' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Stricter limit than the global one to slow down password guessing. */
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  login(@Body() body: LoginDto): Promise<AccessToken> {
    return this.auth.login(body.email, body.password);
  }
}
