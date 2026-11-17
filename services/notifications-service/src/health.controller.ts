import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, ConnectionStates } from 'mongoose';

@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Get('live')
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  ready(): { status: 'ok' } {
    if (this.connection.readyState !== ConnectionStates.connected) {
      throw new ServiceUnavailableException('database unavailable');
    }
    return { status: 'ok' };
  }
}
