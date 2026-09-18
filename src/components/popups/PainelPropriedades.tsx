import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ElementoPopup, EtapaPopup, Popup } from "@/lib/popups";
import { FONTE_GOOGLE_MARCA, FONTE_TITULO_MARCA, IDENTIDADE_MC } from "@/lib/popups";
import { Campo, CampoCor, CampoImagem, CampoNumero, CampoTexto } from "./campos";

const FORMATOS = [
  { v: "modal", n: "Modal" },
  { v: "lateral", n: "Lateral (canto)" },
  { v: "barra", n: "Barra" },
  { v: "tela_cheia", n: "Tela cheia" },
];

function Secao({ titulo, children, aberta = true }: { titulo: string; children: React.ReactNode; aberta?: boolean }) {
  const [open, setOpen] = useState(aberta);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-md border border-border">
      <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wide">
        {titulo}
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 px-3 pb-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}

function Aviso({ texto }: { texto: string }) {
  return (
    <div className="flex gap-2 rounded-md border border-warning/30 bg-warning/10 p-2 text-[11px] text-warning">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{texto}</span>
    </div>
  );
}

/* ======================= Configurações do popup ======================= */

export function ConfigPopup({
  popup,
  mudar,
}: {
  popup: Popup;
  mudar: (patch: Partial<Popup>) => void;
}) {
  const d = popup.design ?? {};
  const setD = (patch: any) => mudar({ design: { ...d, ...patch } });
  const setSub = (chave: string, patch: any) => setD({ [chave]: { ...(d[chave] ?? {}), ...patch } });
  const id = popup.id ?? "novo";

  return (
    <div className="space-y-3">
      <Secao titulo="Identidade">
        <p className="text-[11px] leading-snug text-muted-foreground">
          Deixa o popup com a cara da marca: papel creme, moldura dourada, título em serifa e cupom em ticket.
          Textos e etapas continuam como estão.
        </p>
        <Button className="w-full" onClick={() => setD({ ...IDENTIDADE_MC })}>
          Aplicar identidade Mariana Cardoso
        </Button>
      </Secao>

      <OfertaBloco popup={popup} mudar={mudar} />

      <Secao titulo="Formato">
        <div className="grid grid-cols-2 gap-2">
          {FORMATOS.map((f) => (
            <button
              key={f.v}
              onClick={() => mudar({ formato: f.v })}
              className={cn(
                "rounded-md border p-2 text-xs transition",
                popup.formato === f.v ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"
              )}
            >
              {f.n}
            </button>
          ))}
        </div>
        {popup.formato === "tela_cheia" && (
          <Aviso texto="No celular, tela cheia cobrindo o conteúdo é rebaixada pelo Google e parece agressiva." />
        )}

        {popup.formato === "lateral" && (
          <Campo rotulo="Posição">
            <Select value={d.posicao ?? "canto_direito"} onValueChange={(v) => setD({ posicao: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="canto_direito">Canto direito</SelectItem>
                <SelectItem value="canto_esquerdo">Canto esquerdo</SelectItem>
              </SelectContent>
            </Select>
          </Campo>
        )}
        {popup.formato === "barra" && (
          <Campo rotulo="Posição">
            <Select value={d.posicao ?? "topo"} onValueChange={(v) => setD({ posicao: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="topo">Topo</SelectItem>
                <SelectItem value="rodape">Rodapé</SelectItem>
              </SelectContent>
            </Select>
          </Campo>
        )}
        {popup.formato === "modal" && (
          <Campo rotulo="No celular">
            <Select value={d.mobile?.formato ?? "centro"} onValueChange={(v) => setSub("mobile", { formato: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="centro">Centralizado</SelectItem>
                <SelectItem value="folha">Folha que sobe de baixo</SelectItem>
              </SelectContent>
            </Select>
          </Campo>
        )}
      </Secao>

      <Secao titulo="Tamanho" aberta={false}>
        <CampoNumero
          rotulo="Largura no desktop (px)" min={260} max={1100}
          valor={d.largura ?? 480} aoMudar={(v) => setD({ largura: v })}
          dica="400 a 600 px é o tamanho que funciona."
        />
        <CampoNumero rotulo="Bordas arredondadas" min={0} max={40} valor={d.raio ?? 12} aoMudar={(v) => setD({ raio: v })} />
        <CampoNumero rotulo="Espaçamento interno" min={12} max={56} valor={d.espacamento ?? 24} aoMudar={(v) => setD({ espacamento: v })} />
      </Secao>

      <Secao titulo="Cores e fonte" aberta={false}>
        <CampoCor rotulo="Fundo" valor={d.fundo ?? ""} aoMudar={(v) => setD({ fundo: v })} />
        <CampoCor rotulo="Texto" valor={d.cor_texto ?? ""} aoMudar={(v) => setD({ cor_texto: v })} />
        <CampoCor rotulo="Destaque (botões e foco)" valor={d.cor_destaque ?? ""} aoMudar={(v) => setD({ cor_destaque: v })} />
        <Campo rotulo="Texto sobre destaque" dica="Vazio calcula o contraste sozinho.">
          <Input value={d.cor_destaque_texto ?? ""} onChange={(e) => setD({ cor_destaque_texto: e.target.value })} placeholder="automático" />
        </Campo>
        <Campo rotulo="Fonte">
          <Select
            value={d.fonte && d.fonte !== "herdar" ? "livre" : "herdar"}
            onValueChange={(v) => setD({ fonte: v === "herdar" ? "herdar" : "" })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="herdar">Mesma do site</SelectItem>
              <SelectItem value="livre">Escolher fonte</SelectItem>
            </SelectContent>
          </Select>
          {d.fonte !== undefined && d.fonte !== "herdar" && (
            <Input className="mt-2" value={d.fonte ?? ""} onChange={(e) => setD({ fonte: e.target.value })} placeholder="Poppins, sans-serif" />
          )}
        </Campo>
        <Campo
          rotulo="Fonte do título"
          dica="Cormorant Garamond não serve: o acento de 'você' fica deslocado nessa fonte."
        >
          <Select
            value={
              !d.fonte_titulo ? "mesma" : d.fonte_titulo === FONTE_TITULO_MARCA ? "marca" : "livre"
            }
            onValueChange={(v) => {
              if (v === "mesma") return setD({ fonte_titulo: "" });
              if (v === "marca") {
                const fontes = Array.from(new Set([...(d.fontes ?? []), FONTE_GOOGLE_MARCA]));
                return setD({ fonte_titulo: FONTE_TITULO_MARCA, fontes });
              }
              setD({ fonte_titulo: " " });
            }}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="mesma">Mesma do texto</SelectItem>
              <SelectItem value="marca">EB Garamond (marca)</SelectItem>
              <SelectItem value="livre">Livre</SelectItem>
            </SelectContent>
          </Select>
          {!!d.fonte_titulo && d.fonte_titulo !== FONTE_TITULO_MARCA && (
            <Input
              className="mt-2"
              value={String(d.fonte_titulo ?? "").trim()}
              onChange={(e) => setD({ fonte_titulo: e.target.value })}
              placeholder="'EB Garamond', Georgia, serif"
            />
          )}
        </Campo>
      </Secao>

      <Secao titulo="Moldura" aberta={false}>
        <p className="text-[11px] leading-snug text-muted-foreground">
          Linha fina por dentro do cartão. Sem cor, o popup fica sem moldura.
        </p>
        <CampoCor rotulo="Cor da moldura" valor={d.moldura?.cor ?? ""} aoMudar={(v) => setSub("moldura", { cor: v })} />
        <CampoNumero rotulo="Distância da borda" min={0} max={30} valor={d.moldura?.distancia ?? 10} aoMudar={(v) => setSub("moldura", { distancia: v })} />
        <CampoNumero rotulo="Espessura" min={0} max={4} valor={d.moldura?.largura ?? 1} aoMudar={(v) => setSub("moldura", { largura: v })} />
        {!!d.moldura?.cor && (
          <Button variant="ghost" size="sm" onClick={() => setD({ moldura: {} })}>Tirar a moldura</Button>
        )}
      </Secao>

      <Secao titulo="Fundo escuro atrás" aberta={false}>
        <div className="flex items-center justify-between">
          <Label className="text-xs">Escurecer o site atrás</Label>
          <Switch checked={!!d.overlay?.ativo} onCheckedChange={(v) => setSub("overlay", { ativo: v })} />
        </div>
        <CampoCor rotulo="Cor do fundo escuro" valor={d.overlay?.cor ?? ""} aoMudar={(v) => setSub("overlay", { cor: v })} />
        <CampoNumero
          rotulo="Opacidade" min={0} max={0.95} passo={0.05}
          valor={d.overlay?.opacidade ?? 0.5} aoMudar={(v) => setSub("overlay", { opacidade: v })}
        />
        <div className="flex items-center justify-between">
          <Label className="text-xs">Fechar ao clicar fora</Label>
          <Switch checked={!!d.overlay?.fechar_ao_clicar} onCheckedChange={(v) => setSub("overlay", { fechar_ao_clicar: v })} />
        </div>
      </Secao>

      <Secao titulo="Campos e botões" aberta={false}>
        <Campo rotulo="Estilo do campo">
          <Select value={d.campos?.estilo ?? "caixa"} onValueChange={(v) => setSub("campos", { estilo: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="caixa">Caixa</SelectItem>
              <SelectItem value="linha">Só linha embaixo</SelectItem>
            </SelectContent>
          </Select>
        </Campo>
        <CampoCor rotulo="Fundo do campo" valor={d.campos?.fundo ?? ""} aoMudar={(v) => setSub("campos", { fundo: v })} />
        <CampoCor rotulo="Borda do campo" valor={d.campos?.borda ?? ""} aoMudar={(v) => setSub("campos", { borda: v })} />
        <CampoCor rotulo="Cor do placeholder" valor={d.campos?.placeholder ?? ""} aoMudar={(v) => setSub("campos", { placeholder: v })} />
        <CampoNumero rotulo="Arredondamento do campo" min={0} max={40} valor={d.campos?.raio ?? 8} aoMudar={(v) => setSub("campos", { raio: v })} />
        <CampoCor rotulo="Cor do texto do campo" valor={d.campos?.texto ?? ""} aoMudar={(v) => setSub("campos", { texto: v })} />
        <CampoNumero rotulo="Arredondamento do botão" min={0} max={40} valor={d.botao_raio ?? 8} aoMudar={(v) => setD({ botao_raio: v })} />
        <div className="flex items-center justify-between">
          <Label className="text-xs">Botão em caixa alta</Label>
          <Switch checked={!!d.botao_estilo?.caixa_alta} onCheckedChange={(v) => setSub("botao_estilo", { caixa_alta: v })} />
        </div>
        <CampoNumero
          rotulo="Espaçamento entre letras do botão" min={0} max={0.3} passo={0.01}
          valor={d.botao_estilo?.espacamento ?? 0} aoMudar={(v) => setSub("botao_estilo", { espacamento: v })}
        />
        <div className="flex items-center justify-between">
          <Label className="text-xs">Esconder o botão X</Label>
          <Switch checked={!!d.botao_fechar?.oculto} onCheckedChange={(v) => setSub("botao_fechar", { oculto: v })} />
        </div>
        {d.botao_fechar?.oculto && <Aviso texto="Sem X visível, quem não acha como fechar sai do site." />}
        <CampoCor rotulo="Fundo do X" valor={d.botao_fechar?.fundo ?? ""} aoMudar={(v) => setSub("botao_fechar", { fundo: v })} />
        <CampoCor rotulo="Cor do X" valor={d.botao_fechar?.cor ?? ""} aoMudar={(v) => setSub("botao_fechar", { cor: v })} />
      </Secao>

      <Secao titulo="Cupom" aberta={false}>
        <Campo rotulo="Estilo do cupom">
          <Select value={d.cupom?.estilo ?? "simples"} onValueChange={(v) => setSub("cupom", { estilo: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="simples">Simples</SelectItem>
              <SelectItem value="ticket">Ticket</SelectItem>
            </SelectContent>
          </Select>
        </Campo>
        <CampoCor rotulo="Cor da borda" valor={d.cupom?.borda ?? ""} aoMudar={(v) => setSub("cupom", { borda: v })} />
        <CampoCor rotulo="Fundo" valor={d.cupom?.fundo ?? ""} aoMudar={(v) => setSub("cupom", { fundo: v })} />
        <CampoCor rotulo="Texto" valor={d.cupom?.texto ?? ""} aoMudar={(v) => setSub("cupom", { texto: v })} />
        <CampoCor rotulo="Fundo do botão Copiar" valor={d.cupom?.botao_fundo ?? ""} aoMudar={(v) => setSub("cupom", { botao_fundo: v })} />
        <CampoCor rotulo="Texto do botão Copiar" valor={d.cupom?.botao_texto ?? ""} aoMudar={(v) => setSub("cupom", { botao_texto: v })} />
      </Secao>

      <Secao titulo="Imagem lateral" aberta={false}>
        <CampoImagem rotulo="Imagem" valor={d.imagem_lateral?.src ?? ""} aoMudar={(v) => setSub("imagem_lateral", { src: v })} popupId={id} />
        <CampoImagem rotulo="Imagem no celular" valor={d.imagem_lateral?.src_mobile ?? ""} aoMudar={(v) => setSub("imagem_lateral", { src_mobile: v })} popupId={id} />
        <Campo rotulo="Posição">
          <Select value={d.imagem_lateral?.posicao ?? "esquerda"} onValueChange={(v) => setSub("imagem_lateral", { posicao: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="esquerda">Esquerda</SelectItem>
              <SelectItem value="direita">Direita</SelectItem>
              <SelectItem value="topo">Topo</SelectItem>
            </SelectContent>
          </Select>
        </Campo>
        <Campo rotulo="No celular">
          <Select value={d.imagem_lateral?.mobile ?? "topo"} onValueChange={(v) => setSub("imagem_lateral", { mobile: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="topo">Topo</SelectItem>
              <SelectItem value="oculta">Oculta</SelectItem>
            </SelectContent>
          </Select>
        </Campo>
        <Campo rotulo="Descrição da imagem">
          <Input value={d.imagem_lateral?.alt ?? ""} onChange={(e) => setSub("imagem_lateral", { alt: e.target.value })} />
        </Campo>
      </Secao>

      <Secao titulo="Mensagens" aberta={false}>
        <CampoTexto
          rotulo="Quando já recebeu cupom"
          valor={d.mensagens?.reenviado ?? ""}
          aoMudar={(v) => setSub("mensagens", { reenviado: v })}
          multilinha
        />
        <CampoTexto
          rotulo="Quando já é cliente"
          valor={d.mensagens?.ja_cliente ?? ""}
          aoMudar={(v) => setSub("mensagens", { ja_cliente: v })}
          multilinha
        />
      </Secao>
    </div>
  );
}

/* ======================= Oferta ======================= */

export function OfertaBloco({ popup, mudar }: { popup: Popup; mudar: (patch: Partial<Popup>) => void }) {
  const o = popup.oferta ?? { tipo: "nenhuma" };
  const setO = (patch: any) => mudar({ oferta: { ...o, ...patch } });

  return (
    <Secao titulo="Oferta">
      <Campo rotulo="Tipo de oferta">
        <Select value={o.tipo ?? "nenhuma"} onValueChange={(v) => setO({ tipo: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="nenhuma">Só captura</SelectItem>
            <SelectItem value="cupom_fixo">Cupom fixo</SelectItem>
            <SelectItem value="cupom_tray">Cupom automático na Tray</SelectItem>
          </SelectContent>
        </Select>
      </Campo>

      {o.tipo === "cupom_fixo" && (
        <>
          <Campo rotulo="Código">
            <Input value={o.codigo ?? ""} onChange={(e) => setO({ codigo: e.target.value.toUpperCase() })} />
          </Campo>
          <Aviso texto="Código fixo pode ser compartilhado. Prefira o automático." />
        </>
      )}

      {o.tipo === "cupom_tray" && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Campo rotulo="Valor">
              <Input type="number" min={0} value={o.valor ?? 0} onChange={(e) => setO({ valor: Number(e.target.value) || 0 })} />
            </Campo>
            <Campo rotulo="Tipo">
              <Select value={o.tipo_valor ?? "$"} onValueChange={(v) => setO({ tipo_valor: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="$">R$</SelectItem>
                  <SelectItem value="%">%</SelectItem>
                </SelectContent>
              </Select>
            </Campo>
          </div>
          <CampoNumero rotulo="Validade (dias)" min={1} max={60} valor={o.validade_dias ?? 7} aoMudar={(v) => setO({ validade_dias: v })} />
          <Campo rotulo="Prefixo do código" dica="Letras e números, até 12.">
            <Input
              value={o.prefixo ?? "BEMVINDA"}
              maxLength={12}
              onChange={(e) => setO({ prefixo: e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase() })}
            />
          </Campo>
          <Campo rotulo="Pedido mínimo (opcional)">
            <Input
              type="number" min={0} value={o.pedido_minimo ?? ""}
              onChange={(e) => setO({ pedido_minimo: e.target.value === "" ? null : Number(e.target.value) })}
            />
          </Campo>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Acumulativo com outras promoções</Label>
            <Switch checked={!!o.acumulativo} onCheckedChange={(v) => setO({ acumulativo: v })} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Só primeira compra</Label>
            <Switch checked={o.so_primeira_compra !== false} onCheckedChange={(v) => setO({ so_primeira_compra: v })} />
          </div>
          <div className="rounded-md border border-border bg-muted/50 p-2 text-[11px] leading-snug text-muted-foreground">
            Cada pessoa recebe um código único, que serve uma vez e só na conta dela. Quem já recebeu e ainda não usou
            recebe o mesmo código de novo. Com "Só primeira compra" ligado, quem já tem pedido na loja não recebe cupom e
            vê a etapa de "já é cliente".
          </div>
        </>
      )}
    </Secao>
  );
}

/* ======================= Elemento selecionado ======================= */

const ALINHAR = [
  { v: "left", n: "Esquerda" },
  { v: "center", n: "Centro" },
  { v: "right", n: "Direita" },
];

export const ACOES_APP: { v: string; n: string }[] = [
  { v: "instalar", n: "Instalar app" },
  { v: "ativar_avisos", n: "Ativar avisos" },
  { v: "meus_pedidos", n: "Meus pedidos" },
  { v: "cashback", n: "Meu cashback" },
  { v: "trocas", n: "Trocas e devoluções" },
  { v: "whatsapp", n: "WhatsApp" },
  { v: "loja", n: "Loja" },
];

export function PropsElemento({
  elemento,
  mudar,
  etapas,
  popupId,
  destino = "site",
}: {
  elemento: ElementoPopup;
  mudar: (patch: Partial<ElementoPopup>) => void;
  etapas: EtapaPopup[];
  popupId: number | string;
  destino?: "site" | "app";
}) {
  const e = elemento;
  const ehAcaoApp = e.acao === "link" && String(e.url ?? "").startsWith("#mc-app-");
  const alinhar = (
    <Campo rotulo="Alinhamento">
      <Select value={e.alinhar ?? "center"} onValueChange={(v) => mudar({ alinhar: v })}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>{ALINHAR.map((a) => <SelectItem key={a.v} value={a.v}>{a.n}</SelectItem>)}</SelectContent>
      </Select>
    </Campo>
  );

  const estilo = (
    <Campo rotulo="Estilo">
      <Select value={e.estilo ?? "normal"} onValueChange={(v) => mudar({ estilo: v })}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="normal">Normal</SelectItem>
          <SelectItem value="italico">Itálico</SelectItem>
        </SelectContent>
      </Select>
    </Campo>
  );

  return (
    <div className="space-y-3">
      {e.tipo === "titulo" && (
        <>
          <CampoTexto rotulo="Texto" valor={e.texto ?? ""} aoMudar={(v) => mudar({ texto: v })} />
          <CampoNumero rotulo="Tamanho (px)" min={12} max={72} valor={e.tamanho ?? 28} aoMudar={(v) => mudar({ tamanho: v })} />
          <CampoNumero rotulo="Tamanho no celular (px)" min={12} max={60} valor={e.tamanho_mobile ?? 22} aoMudar={(v) => mudar({ tamanho_mobile: v })} />
          <CampoNumero rotulo="Peso" min={400} max={800} passo={100} valor={e.peso ?? 700} aoMudar={(v) => mudar({ peso: v })} />
          <CampoCor rotulo="Cor" valor={e.cor ?? ""} aoMudar={(v) => mudar({ cor: v })} />
          {estilo}
          {alinhar}
        </>
      )}

      {e.tipo === "texto" && (
        <>
          <CampoTexto rotulo="Texto" valor={e.texto ?? ""} aoMudar={(v) => mudar({ texto: v })} multilinha />
          <CampoNumero rotulo="Tamanho (px)" min={10} max={32} valor={e.tamanho ?? 15} aoMudar={(v) => mudar({ tamanho: v })} />
          <CampoNumero rotulo="Peso" min={400} max={800} passo={100} valor={e.peso ?? 400} aoMudar={(v) => mudar({ peso: v })} />
          <CampoCor rotulo="Cor" valor={e.cor ?? ""} aoMudar={(v) => mudar({ cor: v })} />
          {estilo}
          {alinhar}
        </>
      )}

      {e.tipo === "badge" && (
        <>
          <CampoTexto rotulo="Texto" valor={e.texto ?? ""} aoMudar={(v) => mudar({ texto: v })} />
          <CampoCor rotulo="Cor de fundo" valor={e.cor_fundo ?? ""} aoMudar={(v) => mudar({ cor_fundo: v })} />
          <CampoCor rotulo="Cor do texto" valor={e.cor_texto ?? ""} aoMudar={(v) => mudar({ cor_texto: v })} />
          {alinhar}
        </>
      )}

      {e.tipo === "imagem" && (
        <>
          <CampoImagem rotulo="Imagem" valor={e.src ?? ""} aoMudar={(v) => mudar({ src: v })} popupId={popupId} />
          <CampoImagem rotulo="Imagem no celular" valor={e.src_mobile ?? ""} aoMudar={(v) => mudar({ src_mobile: v })} popupId={popupId} />
          <Campo rotulo="Descrição da imagem">
            <Input value={e.alt ?? ""} onChange={(ev) => mudar({ alt: ev.target.value })} />
          </Campo>
          <Campo rotulo="Largura" dica="Use 100% ou um valor em px, por exemplo 240px.">
            <Input value={e.largura ?? "100%"} onChange={(ev) => mudar({ largura: ev.target.value })} />
          </Campo>
          <CampoNumero rotulo="Bordas arredondadas" min={0} max={40} valor={e.raio ?? 0} aoMudar={(v) => mudar({ raio: v })} />
          <Campo rotulo="Link ao clicar">
            <Input value={e.link ?? ""} onChange={(ev) => mudar({ link: ev.target.value })} placeholder="https://" />
          </Campo>
          {alinhar}
        </>
      )}

      {e.tipo === "botao" && (
        <>
          <CampoTexto
            rotulo="Texto do botão" valor={e.texto ?? ""} aoMudar={(v) => mudar({ texto: v })}
            dicaExtra="Primeira pessoa e específico converte mais: Quero meu cupom, Liberar meu desconto."
          />
          <Campo rotulo="O que o botão faz">
            <Select
              value={ehAcaoApp ? "app" : (e.acao ?? "proxima")}
              onValueChange={(v) => {
                if (v === "app") mudar({ acao: "link", url: "#mc-app-meus_pedidos" });
                else mudar({ acao: v, ...(ehAcaoApp ? { url: "" } : {}) });
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="proxima">Avançar etapa</SelectItem>
                <SelectItem value="enviar">Enviar formulário</SelectItem>
                <SelectItem value="link">Abrir link</SelectItem>
                <SelectItem value="fechar">Fechar</SelectItem>
                <SelectItem value="ir_etapa">Ir para etapa</SelectItem>
                <SelectItem value="copiar_cupom">Copiar cupom</SelectItem>
                {destino === "app" && <SelectItem value="app">Ação do app</SelectItem>}
              </SelectContent>
            </Select>
          </Campo>
          {ehAcaoApp && (
            <Campo rotulo="Ação do app" dica="O popup fecha sozinho depois do clique.">
              <Select
                value={String(e.url ?? "").replace("#mc-app-", "") || "meus_pedidos"}
                onValueChange={(v) => mudar({ acao: "link", url: `#mc-app-${v}` })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACOES_APP.map((a) => <SelectItem key={a.v} value={a.v}>{a.n}</SelectItem>)}
                </SelectContent>
              </Select>
            </Campo>
          )}
          {e.acao === "link" && !ehAcaoApp && (
            <>
              <Campo rotulo="Endereço">
                <Input value={e.url ?? ""} onChange={(ev) => mudar({ url: ev.target.value })} placeholder="https://" />
              </Campo>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Abrir em nova aba</Label>
                <Switch checked={!!e.nova_aba} onCheckedChange={(v) => mudar({ nova_aba: v })} />
              </div>
            </>
          )}
          {e.acao === "ir_etapa" && (
            <Campo rotulo="Etapa de destino">
              <Select value={e.destino ?? ""} onValueChange={(v) => mudar({ destino: v })}>
                <SelectTrigger><SelectValue placeholder="Escolher etapa" /></SelectTrigger>
                <SelectContent>
                  {etapas.map((et, i) => <SelectItem key={et.id} value={et.id}>{i + 1}. {et.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </Campo>
          )}
          <CampoCor rotulo="Cor de fundo" valor={e.cor_fundo ?? ""} aoMudar={(v) => mudar({ cor_fundo: v })} />
          <CampoCor rotulo="Cor do texto" valor={e.cor_texto ?? ""} aoMudar={(v) => mudar({ cor_texto: v })} />
          <Campo rotulo="Largura">
            <Select value={e.largura ?? "total"} onValueChange={(v) => mudar({ largura: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="total">Largura total</SelectItem>
                <SelectItem value="auto">Do tamanho do texto</SelectItem>
              </SelectContent>
            </Select>
          </Campo>
        </>
      )}

      {e.tipo === "link_fechar" && (
        <CampoTexto
          rotulo="Texto" valor={e.texto ?? ""} aoMudar={(v) => mudar({ texto: v })}
          dicaExtra="Neutro e educado: Agora não, Talvez depois. Nada de culpa."
        />
      )}

      {e.tipo === "campo" && (
        <>
          <Campo rotulo="Tipo do campo">
            <Input value={e.campo ?? ""} disabled />
          </Campo>
          <Campo rotulo="Rótulo">
            <Input value={e.rotulo ?? ""} onChange={(ev) => mudar({ rotulo: ev.target.value })} />
          </Campo>
          <Campo rotulo="Texto de exemplo dentro do campo">
            <Input value={e.placeholder ?? ""} onChange={(ev) => mudar({ placeholder: ev.target.value })} />
          </Campo>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Obrigatório</Label>
            <Switch checked={!!e.obrigatorio} onCheckedChange={(v) => mudar({ obrigatorio: v })} />
          </div>
        </>
      )}

      {e.tipo === "consentimento" && (
        <>
          <CampoTexto rotulo="Texto" valor={e.texto ?? ""} aoMudar={(v) => mudar({ texto: v })} multilinha />
          <div className="flex items-center justify-between">
            <Label className="text-xs">Obrigatório</Label>
            <Switch checked={!!e.obrigatorio} onCheckedChange={(v) => mudar({ obrigatorio: v })} />
          </div>
          <p className="text-[11px] text-muted-foreground">A caixa nunca vem marcada.</p>
          <Campo rotulo="Link da política">
            <Input value={e.link_privacidade ?? "/privacidade"} onChange={(ev) => mudar({ link_privacidade: ev.target.value })} />
          </Campo>
          <Campo rotulo="Texto do link">
            <Input value={e.texto_privacidade ?? ""} onChange={(ev) => mudar({ texto_privacidade: ev.target.value })} />
          </Campo>
        </>
      )}

      {e.tipo === "cupom" && (
        <>
          <CampoTexto rotulo="Rótulo" valor={e.rotulo ?? ""} aoMudar={(v) => mudar({ rotulo: v })} />
          <CampoTexto rotulo="Texto do botão" valor={e.texto_botao ?? ""} aoMudar={(v) => mudar({ texto_botao: v })} />
        </>
      )}

      {e.tipo === "timer" && (
        <>
          <Campo
            rotulo="Contar até"
            dica="O timer só conta prazos reais: o fim da campanha ou o vencimento do cupom. Não existe timer que reinicia a cada visita, de propósito."
          >
            <Select value={e.modo ?? "fim_campanha"} onValueChange={(v) => mudar({ modo: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fim_campanha">Data de fim do popup</SelectItem>
                <SelectItem value="validade_cupom">Vencimento do cupom gerado</SelectItem>
              </SelectContent>
            </Select>
          </Campo>
          <CampoTexto rotulo="Rótulo" valor={e.rotulo ?? ""} aoMudar={(v) => mudar({ rotulo: v })} />
        </>
      )}

      {e.tipo === "espaco" && (
        <CampoNumero rotulo="Altura" min={0} max={120} valor={e.altura ?? 16} aoMudar={(v) => mudar({ altura: v })} />
      )}

      {e.tipo === "assinatura" && (
        <>
          <CampoTexto rotulo="Texto" valor={e.texto ?? ""} aoMudar={(v) => mudar({ texto: v })} />
          <CampoNumero rotulo="Tamanho (px)" min={12} max={40} valor={e.tamanho ?? 21} aoMudar={(v) => mudar({ tamanho: v })} />
          <CampoCor rotulo="Cor" valor={e.cor ?? ""} aoMudar={(v) => mudar({ cor: v })} />
          {alinhar}
        </>
      )}

      {e.tipo === "nota" && (
        <>
          <CampoTexto rotulo="Texto" valor={e.texto ?? ""} aoMudar={(v) => mudar({ texto: v })} multilinha />
          {alinhar}
        </>
      )}

      {(e.tipo === "divisor" || e.tipo === "aviso") && (
        <p className="text-xs text-muted-foreground">Este elemento não tem ajustes.</p>
      )}

      <div className="space-y-3 border-t border-border pt-3">
        <CampoNumero rotulo="Espaço abaixo" min={0} max={64} valor={e.margem ?? 12} aoMudar={(v) => mudar({ margem: v })} />
        <Campo rotulo="Onde aparece">
          <Select value={e.visivel ?? "todos"} onValueChange={(v) => mudar({ visivel: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Computador e celular</SelectItem>
              <SelectItem value="desktop">Só no computador</SelectItem>
              <SelectItem value="mobile">Só no celular</SelectItem>
            </SelectContent>
          </Select>
        </Campo>
      </div>
    </div>
  );
}
