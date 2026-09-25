import QRCode from "qrcode";

/** Endereço curto que o QR aponta. Usa o domínio em que o painel está aberto. */
export const urlOrdemCorte = (id: string) => `${window.location.origin}/oc/${id}`;
export const urlOrdemProducao = (id: string) => `${window.location.origin}/op/${id}`;

/** SVG do QR gerado de forma síncrona (para entrar nas fichas impressas sem bloquear a janela). */
export function qrSvg(texto: string, tamanhoPx = 120): string {
  const { size, data } = QRCode.create(texto, { errorCorrectionLevel: "M" }).modules;
  const m = 2; // margem em módulos
  const total = size + m * 2;
  let path = "";
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (data[y * size + x]) path += `M${x + m} ${y + m}h1v1h-1z`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${tamanhoPx}" height="${tamanhoPx}" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
}

/** Bloco com QR + legenda para colar no topo da ficha impressa. */
export function qrBlocoFicha(url: string, legenda = "Escaneie para abrir a ordem") {
  return `<div style="display:flex;align-items:center;gap:10px;margin:8px 0 12px;">${qrSvg(url, 96)}<div style="font-size:11px;color:#555;">${legenda}<br/><span style="font-size:9px;word-break:break-all;">${url}</span></div></div>`;
}
