/**
 * SmartQ - High-Performance Canvas Charting Engine
 * Zero external dependencies. Pixel-sharp DPI rendering with smooth animations.
 */

class SmartQCharts {
  /**
   * Set up canvas for Retina / High-DPI displays
   */
  static setupCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    return { ctx, width: rect.width, height: rect.height };
  }

  /**
   * Draw Multi-series Time Series Chart (Queue Length / Wait Time over time)
   */
  static drawTimeSeries(canvasId, seriesList, options = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const { ctx, width, height } = this.setupCanvas(canvas);

    const padding = { top: 20, right: 30, bottom: 40, left: 50 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    ctx.clearRect(0, 0, width, height);

    // Find min and max across all series
    let maxX = 0;
    let maxY = 0;

    seriesList.forEach(s => {
      s.data.forEach(pt => {
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y > maxY) maxY = pt.y;
      });
    });

    if (maxY === 0) maxY = 10;
    maxY = Math.ceil(maxY * 1.15); // Add 15% headroom

    // Draw horizontal grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    const yTicks = 5;
    ctx.fillStyle = '#9ca3af';
    ctx.font = '10px -apple-system, sans-serif';
    ctx.textAlign = 'right';

    for (let i = 0; i <= yTicks; i++) {
      const yVal = (maxY / yTicks) * i;
      const yPos = padding.top + chartH - (i / yTicks) * chartH;

      ctx.beginPath();
      ctx.moveTo(padding.left, yPos);
      ctx.lineTo(padding.left + chartW, yPos);
      ctx.stroke();

      ctx.fillText(Math.round(yVal), padding.left - 8, yPos + 3);
    }

    // Draw X-axis ticks
    ctx.textAlign = 'center';
    const xTicks = 6;
    for (let i = 0; i <= xTicks; i++) {
      const xVal = (maxX / xTicks) * i;
      const xPos = padding.left + (i / xTicks) * chartW;
      ctx.fillText(`${Math.round(xVal)}m`, xPos, height - padding.bottom + 18);
    }

    // X and Y Axis titles
    ctx.fillStyle = '#6b7280';
    ctx.font = '11px -apple-system, sans-serif';
    ctx.fillText(options.xLabel || 'Elapsed Time (min)', padding.left + chartW / 2, height - 6);

    ctx.save();
    ctx.translate(14, padding.top + chartH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(options.yLabel || 'Value', 0, 0);
    ctx.restore();

    // Plot each series
    seriesList.forEach(s => {
      if (!s.data || s.data.length === 0) return;

      const points = s.data.map(pt => ({
        x: padding.left + (pt.x / Math.max(1, maxX)) * chartW,
        y: padding.top + chartH - (pt.y / maxY) * chartH,
      }));

      // Draw filled area gradient
      if (s.fill) {
        const grad = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
        grad.addColorStop(0, s.fillColorStart || 'rgba(59, 130, 246, 0.25)');
        grad.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(points[0].x, padding.top + chartH);
        points.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.lineTo(points[points.length - 1].x, padding.top + chartH);
        ctx.closePath();
        ctx.fill();
      }

      // Draw line
      ctx.strokeStyle = s.color || '#3b82f6';
      ctx.lineWidth = s.lineWidth || 2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      points.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
    });

    // Draw Legend
    let legendX = padding.left + 10;
    const legendY = padding.top + 5;
    ctx.font = '11px -apple-system, sans-serif';
    ctx.textAlign = 'left';

    seriesList.forEach(s => {
      ctx.fillStyle = s.color || '#3b82f6';
      ctx.fillRect(legendX, legendY - 8, 12, 8);
      ctx.fillStyle = '#d1d5db';
      ctx.fillText(s.name, legendX + 16, legendY);
      legendX += ctx.measureText(s.name).width + 32;
    });
  }

  /**
   * Draw Side-by-Side Comparative Bar Chart
   */
  static drawBarChart(canvasId, labels, datasets, options = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const { ctx, width, height } = this.setupCanvas(canvas);

    const padding = { top: 25, right: 20, bottom: 45, left: 55 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    ctx.clearRect(0, 0, width, height);

    // Max value
    let maxVal = 0;
    datasets.forEach(ds => {
      ds.data.forEach(val => {
        if (val > maxVal) maxVal = val;
      });
    });
    if (maxVal === 0) maxVal = 10;
    maxVal = Math.ceil(maxVal * 1.2);

    // Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#9ca3af';
    ctx.font = '10px -apple-system, sans-serif';
    ctx.textAlign = 'right';

    const yTicks = 4;
    for (let i = 0; i <= yTicks; i++) {
      const val = (maxVal / yTicks) * i;
      const yPos = padding.top + chartH - (i / yTicks) * chartH;
      ctx.beginPath();
      ctx.moveTo(padding.left, yPos);
      ctx.lineTo(padding.left + chartW, yPos);
      ctx.stroke();
      ctx.fillText(Number(val.toFixed(1)), padding.left - 8, yPos + 3);
    }

    const groupCount = labels.length;
    const groupW = chartW / groupCount;
    const dsCount = datasets.length;
    const barW = Math.min(28, (groupW * 0.7) / dsCount);

    labels.forEach((label, gIdx) => {
      const groupCenter = padding.left + gIdx * groupW + groupW / 2;
      const groupStart = groupCenter - (dsCount * barW) / 2;

      datasets.forEach((ds, dsIdx) => {
        const val = ds.data[gIdx] || 0;
        const barH = (val / maxVal) * chartH;
        const x = groupStart + dsIdx * barW;
        const y = padding.top + chartH - barH;

        ctx.fillStyle = ds.color || '#3b82f6';
        ctx.beginPath();
        ctx.roundRect(x + 2, y, barW - 4, barH, [4, 4, 0, 0]);
        ctx.fill();

        // Value on top of bar
        ctx.fillStyle = '#ffffff';
        ctx.font = '9px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        if (barH > 14) {
          ctx.fillText(Number(val.toFixed(1)), x + barW / 2, y - 4);
        }
      });

      // Label under group
      ctx.fillStyle = '#d1d5db';
      ctx.font = '11px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, groupCenter, height - padding.bottom + 18);
    });

    // Legend
    let legX = padding.left;
    const legY = padding.top - 8;
    ctx.font = '11px -apple-system, sans-serif';
    ctx.textAlign = 'left';

    datasets.forEach(ds => {
      ctx.fillStyle = ds.color;
      ctx.fillRect(legX, legY - 8, 10, 8);
      ctx.fillStyle = '#9ca3af';
      ctx.fillText(ds.name, legX + 14, legY);
      legX += ctx.measureText(ds.name).width + 28;
    });
  }

  /**
   * Draw Circular Progress / Gauge (Utilization & SLA)
   */
  static drawGauge(canvasId, value, label, color = '#3b82f6') {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const { ctx, width, height } = this.setupCanvas(canvas);

    ctx.clearRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.38;
    const lineWidth = 12;

    // Background track
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0.75 * Math.PI, 2.25 * Math.PI);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Progress arc
    const pct = Math.min(100, Math.max(0, value)) / 100;
    const startAngle = 0.75 * Math.PI;
    const totalAngle = 1.5 * Math.PI;
    const endAngle = startAngle + totalAngle * pct;

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Center value text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.round(value)}%`, centerX, centerY - 4);

    // Label below
    ctx.fillStyle = '#9ca3af';
    ctx.font = '11px -apple-system, sans-serif';
    ctx.fillText(label, centerX, centerY + 20);
  }

  /**
   * Draw Congestion Heatmap Timeline Bar
   */
  static drawHeatmapTimeline(canvasId, buckets) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !buckets || buckets.length === 0) return;
    const { ctx, width, height } = this.setupCanvas(canvas);

    ctx.clearRect(0, 0, width, height);

    const barY = 15;
    const barH = 32;
    const bucketW = width / buckets.length;

    buckets.forEach((b, idx) => {
      const x = idx * bucketW;

      // Color from risk score: 0 = emerald, 50 = amber, 100 = rose
      let fill = '#10b981';
      if (b.riskScore > 75) fill = '#f43f5e';
      else if (b.riskScore > 50) fill = '#f59e0b';
      else if (b.riskScore > 30) fill = '#06b6d4';

      ctx.fillStyle = fill;
      ctx.fillRect(x, barY, bucketW - 1, barH);

      // Label below bar
      if (idx % 2 === 0 || idx === buckets.length - 1) {
        ctx.fillStyle = '#9ca3af';
        ctx.font = '9px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(b.timeLabel.split(' - ')[0], x + bucketW / 2, barY + barH + 16);
      }
    });

    // Top indicator
    ctx.fillStyle = '#6b7280';
    ctx.font = '10px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Operating Hours (Time-Bucket Congestion Level: Green = Safe, Amber = Warning, Red = Peak Alert)', 0, 10);
  }
}

window.SmartQCharts = SmartQCharts;
