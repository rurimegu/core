import YAML from 'yaml';
export type LookupFunc<T> = (key: string) => T | undefined;
export type Finalizer<T> = (f: LookupFunc<T>) => void;

export interface ISerializable {
  serialize(): any;
}

export interface IFinalizable<T> {
  deserialize(data: any): Finalizer<T>;
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

export function PathJoin(...parts: string[]): string {
  parts = parts.map((part) => part.replaceAll('\\', '/').replace(/\/+$/g, ''));
  return parts.join('/');
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
