/**
 * BigInt 序列化工具
 * 用于处理数据库中的 BigInt 类型在 JSON 序列化时的问题
 */

/**
 * 将对象中的所有 BigInt 转换为字符串
 */
export function serializeBigInt<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'bigint') {
    return String(obj) as any;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => serializeBigInt(item)) as any;
  }

  if (typeof obj === 'object') {
    const result: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        result[key] = serializeBigInt(obj[key]);
      }
    }
    return result;
  }

  return obj;
}

/**
 * 将对象中的所有 BigInt 转换为数字（注意：可能丢失精度）
 */
export function bigIntToNumber<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'bigint') {
    return Number(obj) as any;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => bigIntToNumber(item)) as any;
  }

  if (typeof obj === 'object') {
    const result: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        result[key] = bigIntToNumber(obj[key]);
      }
    }
    return result;
  }

  return obj;
}

/**
 * 为 JSON.stringify 添加 BigInt 支持（全局方法）
 * 注意：这会修改全局 BigInt 原型，谨慎使用
 */
export function enableBigIntSerialization() {
  // @ts-ignore
  BigInt.prototype.toJSON = function() {
    return this.toString();
  };
}

/**
 * 安全的 JSON.stringify，自动处理 BigInt
 */
export function safeStringify(obj: any, space?: number): string {
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return value;
  }, space);
}

