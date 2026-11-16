import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';

export function randomSource(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function surface(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

export function walnutTexture() {
  return surface(1024, 768, (ctx, w, h) => {
    const random = randomSource(811);
    const image = ctx.createImageData(w, h);
    const data = image.data;
    const tones = [-8, 2, 8, -4, 4, -6, 5, 0];
    const width = h / tones.length;
    for (let y = 0; y < h; y++) {
      const plank = Math.floor(y / width);
      const seam = y % width;
      for (let x = 0; x < w; x++) {
        const warp = Math.sin(x * 0.008 + plank * 3) * 3 + Math.sin(x * 0.022 - y * 0.006) * 1.8;
        const ripple = Math.sin((y + warp) * 0.52) * 2.5 + Math.sin((y + warp) * 1.4) * 2.4;
        const flow = Math.sin(y * 0.115 + Math.sin(x * 0.005) * 1.1) * 3.4;
        const joint = seam < 1 ? -12 : seam < 2 ? 5 : 0;
        const grain = tones[plank] + ripple + flow + joint + (random() - 0.5) * 7;
        const index = (y * w + x) * 4;
        data[index] = 104 + grain;
        data[index + 1] = 68 + grain * 0.81;
        data[index + 2] = 45 + grain * 0.63;
        data[index + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
    for (let n = 0; n < 550; n++) {
      const y = random() * h;
      const x = random() * w;
      const len = 10 + random() ** 2 * 260;
      ctx.strokeStyle = random() > 0.5 ? 'rgba(249,178,115,.07)' : 'rgba(28,13,6,.12)';
      ctx.lineWidth = 0.35 + random();
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + len * 0.32, y - 2, x + len * 0.76, y + 2, x + len, y + 0.5);
      ctx.stroke();
    }
  });
}

export function terrainTexture(color, noise, seed, repeat) {
  const texture = surface(256, 256, (ctx, w, h) => {
    const random = randomSource(seed);
    const image = ctx.createImageData(w, h);
    const data = image.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const n = (random() - 0.5) * noise + (Math.sin(x * 0.23) + Math.sin(y * 0.17)) * noise * 0.09;
        const index = (y * w + x) * 4;
        data[index] = color[0] + n;
        data[index + 1] = color[1] + n;
        data[index + 2] = color[2] + n;
        data[index + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
  });
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(...repeat);
  return texture;
}

export function blueprintTexture(dark) {
  return surface(768, 512, (ctx, w, h) => {
    const paper = dark ? '#20445e' : '#e1d9c5';
    const ink = dark ? '#bddaea' : '#4c6670';
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = ink;
    ctx.globalAlpha = 0.15;
    ctx.lineWidth = 0.7;
    for (let x = 20; x < w - 10; x += 12) {
      ctx.beginPath(); ctx.moveTo(x, 22); ctx.lineTo(x, h - 22); ctx.stroke();
    }
    for (let y = 22; y < h - 10; y += 12) {
      ctx.beginPath(); ctx.moveTo(20, y); ctx.lineTo(w - 20, y); ctx.stroke();
    }
    ctx.globalAlpha = 0.88;
    ctx.strokeRect(22, 20, w - 44, h - 40);
    ctx.strokeRect(28, 26, w - 56, h - 52);
    const line = (x1, y1, x2, y2) => {
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    };
    ctx.lineWidth = 2.4;
    ctx.strokeRect(95, 115, 315, 227);
    ctx.strokeRect(102, 122, 301, 213);
    ctx.strokeRect(199, 181, 106, 92);
    ctx.strokeRect(206, 188, 92, 78);
    ctx.lineWidth = 1.5;
    for (const x of [146, 199, 252, 305, 358]) {
      line(x, 122, x, 181);
      line(x, 274, x, 335);
      for (const y of [122, 335]) {
        ctx.fillStyle = ink;
        ctx.fillRect(x - 3, y - 3, 6, 6);
      }
    }
    for (const y of [166, 224, 281]) {
      line(103, y, 198, y);
      line(306, y, 403, y);
    }
    for (let y = 192; y < 261; y += 5) line(209, y, 232, y);
    line(234, 195, 234, 261);
    line(247, 195, 247, 261);
    ctx.setLineDash([6, 3]);
    line(76, 229, 429, 229);
    line(251, 92, 251, 371);
    ctx.setLineDash([]);
    ctx.lineWidth = 1;
    line(95, 93, 410, 93); line(95, 86, 95, 111); line(410, 86, 410, 111);
    line(75, 115, 75, 342); line(67, 115, 90, 115); line(67, 342, 90, 342);
    ctx.strokeRect(485, 108, 195, 184);
    ctx.strokeRect(497, 119, 171, 160);
    for (let y = 132; y < 279; y += 12) line(497, y, 668, y);
    for (let x = 504; x < 668; x += 27) line(x, 119, x, 279);
    line(477, 293, 694, 293);
    ctx.strokeRect(459, 388, 280, 87);
    line(459, 442, 739, 442);
    line(655, 442, 655, 475);
    ctx.fillStyle = ink;
    ctx.font = '600 26px sans-serif';
    ctx.fillText('筑 城 之 间', 47, 68);
    ctx.font = '14px monospace';
    ctx.fillText('TYPICAL FLOOR PLAN', 92, 369);
    ctx.fillText('SOUTH ELEVATION', 490, 318);
    ctx.fillText('22 000', 220, 87);
    ctx.fillText('LIVING CONSTRUCTION', 472, 417);
    ctx.fillText('BUILDING A   /   STUDY', 472, 463);
    ctx.fillText('1 : 100', 668, 463);
    ctx.fillText('N', 686, 73);
    line(690, 78, 690, 103); line(690, 79, 685, 89); line(690, 79, 695, 89);
  });
}
