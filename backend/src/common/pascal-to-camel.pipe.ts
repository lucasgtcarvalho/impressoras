import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';

function pascalToCamel(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

function transformKeys(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(transformKeys);
  if (typeof obj !== 'object') return obj;
  const result: any = {};
  for (const key of Object.keys(obj)) {
    const camelKey = pascalToCamel(key);
    result[camelKey] = transformKeys(obj[key]);
  }
  return result;
}

@Injectable()
export class PascalToCamelPipe implements PipeTransform {
  async transform(value: any) {
    if (!value || typeof value !== 'object') return value;
    return transformKeys(value);
  }
}
