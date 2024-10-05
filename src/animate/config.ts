import { ResourceMapping } from './resources';
import { z } from 'zod';

export const IntervalData = z
  .object({
    hintLyricsLine: z.number().min(0).max(1e5).default(3),
    hintCallLine: z.number().min(0).max(1e5).default(1.5),
  })
  .strict();
export type IntervalData = z.infer<typeof IntervalData>;

export const RenderTemplateWithDefault = (defaultType: string) =>
  z
    .object({
      type: z.string().default(defaultType),
      options: z.record(z.string().max(128), z.any()).default({}),
    })
    .strict();
export type RenderTemplateData = z.infer<
  ReturnType<typeof RenderTemplateWithDefault>
>;

const RenderTemplates = z
  .object({
    callBlock: RenderTemplateWithDefault('Simple').default({}),
    lyricsBlock: RenderTemplateWithDefault('Gradient').default({}),
    lyricsHint: RenderTemplateWithDefault('Underline').default({}),
    lyricsColumn: RenderTemplateWithDefault('default').default({}),
    metaColumn: RenderTemplateWithDefault('default').default({}),
  })
  .strict();
type RenderTemplates = z.infer<typeof RenderTemplates>;

export const AnimateConfig = z
  .object({
    resources: z
      .record(z.string().max(128), z.string().max(1024))
      .default({})
      .transform((v) => new ResourceMapping(v)),
    fps: z.number().min(1).max(240).default(30),
    openTime: z.number().min(0).max(1e5).default(3),
    width: z.number().int().min(1).max(1e4).default(1280),
    height: z.number().int().min(1).max(1e4).default(720),
    minIntervals: IntervalData.default({}),
    template: RenderTemplates.default({}),
    version: z.number().int().min(1).max(1e5).optional(),
  })
  .strict();

export type AnimateConfigInput = z.input<typeof AnimateConfig>;
export type AnimateConfig = z.output<typeof AnimateConfig>;
