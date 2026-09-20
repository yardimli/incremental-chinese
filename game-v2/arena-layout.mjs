// Cosmetic randomness stays separate from the saved question sequence.
export function scatterCards(
  width,
  height,
  count,
  cardWidth,
  cardHeight,
  dictionaryBottom = 0,
  random = Math.random,
) {
  const gap = 14,
    edge = 8;
  const columns = Math.max(1, Math.floor((width - 2 * edge + gap) / (cardWidth + gap)));
  const rows = Math.ceil(count / columns);
  const minimumHeight = rows * cardHeight + (rows - 1) * gap;
  // Keep clear of the dictionary first. In a crowded arena, preserve card separation.
  const top = Math.max(edge, Math.min(dictionaryBottom + gap, height - edge - minimumHeight));
  const maxX = width - edge - cardWidth,
    maxY = height - edge - cardHeight;
  for (let attempt = 0; attempt < 60; attempt++) {
    const points = [];
    for (let trial = 0; trial < 300 && points.length < count; trial++) {
      const p = { x: edge + random() * (maxX - edge), y: top + random() * (maxY - top) };
      if (
        points.every(
          (q) => Math.abs(p.x - q.x) >= cardWidth + gap || Math.abs(p.y - q.y) >= cardHeight + gap,
        )
      )
        points.push(p);
    }
    if (points.length === count) return points;
  }
  // Dense-layout fallback: random assignment and jitter within nonoverlapping cells.
  const cellWidth = (width - 2 * edge + gap) / columns,
    cellHeight = (height - edge - top + gap) / rows;
  const points = Array.from({ length: count }, (_, i) => ({
    x: edge + (i % columns) * cellWidth + random() * Math.max(0, cellWidth - cardWidth - gap),
    y:
      top +
      Math.floor(i / columns) * cellHeight +
      random() * Math.max(0, cellHeight - cardHeight - gap),
  }));
  for (let i = points.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [points[i], points[j]] = [points[j], points[i]];
  }
  return points;
}
