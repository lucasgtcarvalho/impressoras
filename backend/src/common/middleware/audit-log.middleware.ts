import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class AuditLogMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    const originalSend = res.send;

    res.send = function (body) {
      const duration = Date.now() - start;
      res.locals.duration = duration;
      res.locals.responseBody = body;
      return originalSend.call(this, body);
    };

    next();
  }
}
