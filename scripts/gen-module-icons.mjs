// Converts the design system's flat module-icon SVGs into one react-native-svg
// component module. The source files are multi-path, all `fill:#fff`, so the
// generated component just takes a `color` and paints every child with it.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const SRC = 'C:/Users/Shamim Hasan/Documents/AI Template Photo Editor/assets/module-icons';
const OUT =
  'C:/Users/Shamim Hasan/Documents/sohozkaj-template/src/components/icons/ModuleIcon.jsx';

const pascal = (s) => s.replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase());

const files = readdirSync(SRC).filter((f) => f.endsWith('.svg')).sort();

const entries = files.map((file) => {
  const name = path.basename(file, '.svg');
  const svg = readFileSync(path.join(SRC, file), 'utf8');

  const viewBox = /viewBox="([^"]+)"/.exec(svg)?.[1];
  if (!viewBox) throw new Error(`${file}: no viewBox`);

  const children = [];
  const tagRe = /<(path|polygon|rect)\b([^>]*?)\/?>/g;
  let m;
  while ((m = tagRe.exec(svg))) {
    const [, tag, attrs] = m;
    const attr = (n) => new RegExp(`\\b${n}="([^"]*)"`).exec(attrs)?.[1];
    if (tag === 'path') {
      children.push({ tag: 'Path', props: { d: attr('d') } });
    } else if (tag === 'polygon') {
      children.push({ tag: 'Polygon', props: { points: attr('points') } });
    } else if (tag === 'rect') {
      children.push({
        tag: 'Rect',
        props: {
          x: attr('x'),
          y: attr('y'),
          width: attr('width'),
          height: attr('height'),
          rx: attr('rx'),
          ry: attr('ry'),
        },
      });
    }
  }
  if (!children.length) throw new Error(`${file}: no drawable children`);
  return { name, key: pascal(name), viewBox, children };
});

const renderChild = (c) => {
  const props = Object.entries(c.props)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ');
  return `      <${c.tag} ${props} fill={color} />`;
};

const body = entries
  .map(
    (e) => `  '${e.name}': {
    viewBox: '${e.viewBox}',
    paths: (color) => (
      <>
${e.children.map(renderChild).join('\n')}
      </>
    ),
  },`
  )
  .join('\n');

const out = `import Svg, { Path, Polygon, Rect } from 'react-native-svg';

/**
 * The design system's own flat icon set — \`assets/module-icons/\` — as
 * react-native-svg components.
 *
 * GENERATED. Re-run \`node scripts/gen-module-icons.mjs\` after the design
 * system is re-exported; do not hand-edit the path data.
 *
 * The source files paint every shape \`#fff\` because they are built for
 * saturated wells. Here each shape takes the \`color\` prop instead, so one icon
 * serves an active violet tab, an inactive grey one, and a white-on-gradient
 * tile without three copies of the file.
 */

const ICONS = {
${body}
};

export const MODULE_ICON_NAMES = Object.keys(ICONS);

export default function ModuleIcon({ name, size = 22, color = '#111111' }) {
  const icon = ICONS[name];
  if (!icon) return null;
  return (
    <Svg width={size} height={size} viewBox={icon.viewBox}>
      {icon.paths(color)}
    </Svg>
  );
}
`;

writeFileSync(OUT, out);
console.log(`wrote ${OUT} — ${entries.length} icons: ${entries.map((e) => e.name).join(', ')}`);
