import { Color } from './algo';
import { ValueError } from './error';

export function GradientCss(direction: string, colors: Color[]): string {
  if (colors.length === 0)
    throw new ValueError(
      'At least one color is required to generate a gradient',
    );
  const parts = colors.length * 2;
  const gradients: string[] = [];
  for (let i = 0; i < colors.length; i++) {
    const percentageStart = i === 0 ? 0 : (100 * (i * 2 + 0.5)) / parts;
    const percentageEnd =
      i === colors.length - 1 ? 100 : (100 * (i * 2 + 1.5)) / parts;
    const colorCss = colors[i].tailwindCss();
    gradients.push(`${colorCss} ${percentageStart}%`);
    gradients.push(`${colorCss} ${percentageEnd}%`);
  }
  return `linear-gradient(${direction}, ${gradients.join(', ')})`;
}
