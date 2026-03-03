/**
 * Format a date string (YYYY-MM-DD or ISO) to DD/MM/AAAA.
 */
export function formatDateBR(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * Utility to open a styled print window with HTML content.
 */
export function printHTML(title: string, bodyHTML: string) {
  const win = window.open("", "_blank", "width=800,height=600");
  if (!win) return;

  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; padding: 24px; font-size: 13px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 2px solid #1a1a1a; padding-bottom: 12px; }
    .header h1 { font-size: 20px; font-weight: 700; }
    .header .subtitle { font-size: 11px; color: #666; margin-top: 2px; }
    .header .company { text-align: right; font-size: 11px; color: #666; }
    .header .logo { width: 48px; height: 48px; border-radius: 4px; }
    .section { margin-bottom: 16px; }
    .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #333; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #ddd; }
    .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px 16px; }
    .info-item label { font-size: 10px; text-transform: uppercase; color: #888; display: block; }
    .info-item span { font-size: 13px; font-weight: 500; }
    table { width: 100%; border-collapse: collapse; margin-top: 4px; }
    th { background: #f0f0f0; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; color: #555; text-align: left; padding: 6px 8px; border: 1px solid #ddd; }
    td { padding: 5px 8px; border: 1px solid #ddd; font-size: 12px; }
    tr:nth-child(even) { background: #fafafa; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
    .badge-planejada { background: #e0e7ff; color: #3730a3; }
    .badge-corte, .badge-em-corte { background: #fef3c7; color: #92400e; }
    .badge-costura { background: #fce7f3; color: #9d174d; }
    .badge-revisao, .badge-revisão { background: #dbeafe; color: #1e40af; }
    .badge-finalizada, .badge-finalizado { background: #d1fae5; color: #065f46; }
    .badge-em-conserto { background: #fee2e2; color: #991b1b; }
    .badge-aprovada { background: #d1fae5; color: #065f46; }
    .color-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; border: 1px solid #ccc; vertical-align: middle; margin-right: 4px; }
    .footer { margin-top: 24px; padding-top: 8px; border-top: 1px solid #ddd; font-size: 10px; color: #999; display: flex; justify-content: space-between; }
    .total-row { font-weight: 700; background: #f0f0f0 !important; }
    @media print { body { padding: 12px; } @page { margin: 15mm; } }
  </style>
</head>
<body>
  ${bodyHTML}
  <div class="footer">
    <span>Gestão - Mariana Cardoso</span>
    <span>Impresso em ${new Date().toLocaleString("pt-BR")}</span>
  </div>
  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`);
  win.document.close();
}

export function statusBadgeHTML(status: string) {
  const cls = status.toLowerCase().replace(/\s+/g, "-").replace(/ã/g, "a").replace(/é/g, "e");
  return `<span class="badge badge-${cls}">${status}</span>`;
}
