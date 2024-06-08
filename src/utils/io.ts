import YAML from 'yaml';
import { IWithId } from './types';
import { REF_ID_PREFIX, REF_STR_PREFIX } from './constants';

export interface ISerializable {
  serialize(): any;
}

export interface IDeserializable {
  deserialize(data: any): void;
}

export function SerializeYaml(data: ISerializable): string {
  return YAML.stringify(data.serialize());
}

export function DeserializeYaml(data: string): any {
  return YAML.parse(data);
}

export function SerializeGzip(data: ISerializable): Promise<Blob> {
  const ds = new CompressionStream('gzip');
  const blob = new Blob([JSON.stringify(data.serialize())]);
  const stream = blob.stream().pipeThrough(ds);
  return new Response(stream).blob();
}

export function DeserializeGzip(array: Uint8Array): Promise<any> {
  const ds = new DecompressionStream('gzip');
  const blob = new Blob([array]);
  const stream = blob.stream().pipeThrough(ds);
  return new Response(stream).json();
}

export function PathSanitize(path: string): string {
  return path.replaceAll('\\', '/').replace(/\/+/g, '/');
}

export function PathJoin(...parts: string[]): string {
  return parts.map(PathSanitize).join('/');
}

export function PathBaseDir(path: string): string {
  const parts = path.replaceAll('\\', '/').split('/');
  return PathJoin(...parts.slice(0, -1));
}

export function CmpVersion(v1: string, v2: string): number {
  const v1Parts = v1.split('.').map((p) => parseInt(p));
  const v2Parts = v2.split('.').map((p) => parseInt(p));
  const len = Math.max(v1Parts.length, v2Parts.length);
  for (let i = 0; i < len; i++) {
    const p1 = v1Parts[i] ?? 0;
    const p2 = v2Parts[i] ?? 0;
    if (p1 < p2) return -1;
    if (p1 > p2) return 1;
  }
  return 0;
}

export function SerializeIdOrString(value: string | IWithId) {
  if (typeof value === 'string') {
    if (value.startsWith(REF_STR_PREFIX) || value.startsWith(REF_ID_PREFIX)) {
      return REF_STR_PREFIX + value;
    }
    return value;
  }
  return REF_ID_PREFIX + value;
}

export function IsId(value: string): boolean {
  return value.startsWith(REF_ID_PREFIX);
}

export function GetIdOrString(value: string): string {
  if (!value.startsWith(REF_STR_PREFIX) && !value.startsWith(REF_ID_PREFIX)) {
    return value;
  }
  return value.substring(REF_STR_PREFIX.length);
}
