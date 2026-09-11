import { useEffect, useMemo, useRef, useState } from "react";
import {
  reversa,
  enviarFoto,
  moeda,
  formatarData,
  chaveMotivo,
  chavePreferencia,
  salvarAcompanhamento,
  lerAcompanhamento,
  type RespostaBuscar,
  type RespostaCriar,
  type RespostaStatus,
  type ItemPedido,
  type Motivo,
} from "@/lib/reversaPortal";

/* Estilos próprios da página pública (identidade da loja, fora do painel interno). */
const CSS = `
.rev { --papel:#F4F3EF; --cartao:#FFFFFF; --borda:#E7E4DC; --ouro:#DE9F33; --tinta:#26241F; --suave:#6B6659;
  background:var(--papel); color:var(--tinta); min-height:100vh; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif; }
.rev * { box-sizing:border-box; }
.rev-wrap { max-width:640px; margin:0 auto; padding:20px 16px 64px; }
.rev h1,.rev h2,.rev h3 { font-family:"Playfair Display",Georgia,serif; font-weight:600; margin:0 0 8px; letter-spacing:-.01em; }
.rev h1 { font-size:26px; } .rev h2 { font-size:20px; } .rev h3 { font-size:17px; }
.rev p { margin:0 0 10px; line-height:1.6; color:var(--suave); }
.rev-card { background:var(--cartao); border:1px solid var(--borda); border-radius:12px; padding:16px; margin-bottom:14px; }
.rev-card.sel { border-color:var(--ouro); box-shadow:0 0 0 2px rgba(222,159,51,.25); }
.rev-card.off { opacity:.5; }
.rev label { display:block; font-size:14px; font-weight:600; color:var(--tinta); margin-bottom:6px; }
.rev input[type=text],.rev input[type=tel],.rev input[type=email],.rev textarea,.rev select {
  width:100%; padding:12px; border:1px solid var(--borda); border-radius:12px; background:#fff; color:var(--tinta);
  font-size:16px; font-family:inherit; }
.rev textarea { min-height:76px; resize:vertical; }
.rev :focus-visible { outline:3px solid var(--ouro); outline-offset:2px; }
.rev-btn { display:inline-flex; align-items:center; justify-content:center; gap:8px; width:100%; padding:14px 18px;
  border:none; border-radius:12px; background:var(--ouro); color:#fff; font-size:16px; font-weight:700; cursor:pointer; font-family:inherit; }
.rev-btn:disabled { opacity:.55; cursor:not-allowed; }
.rev-btn.sec { background:#fff; color:var(--tinta); border:1px solid var(--borda); font-weight:600; }
.rev-erro { background:#FDECEC; border:1px solid #E9B4B4; color:#8C2020; border-radius:12px; padding:12px; margin-bottom:14px; font-size:15px; }
.rev-aviso { background:#FBF3E4; border:1px solid #EBD7AB; color:#6B4E12; border-radius:12px; padding:12px; margin-bottom:14px; font-size:15px; }
.rev-item { display:flex; gap:12px; align-items:center; text-align:left; width:100%; background:none; border:none; padding:0; cursor:pointer; font-family:inherit; }
.rev-foto { width:72px; height:88px; object-fit:cover; border-radius:8px; background:#EFEDE7; flex:0 0 auto; }
.rev-mini { width:64px; height:64px; object-fit:cover; border-radius:8px; border:1px solid var(--borda); }
.rev-chip { display:inline-block; font-size:12px; padding:3px 8px; border-radius:999px; border:1px solid var(--borda); color:var(--suave); margin-right:6px; }
.rev-opt { display:block; width:100%; text-align:left; background:#fff; border:1px solid var(--borda); border-radius:12px; padding:12px;
  margin-bottom:8px; cursor:pointer; font-family:inherit; font-size:15px; color:var(--tinta); }
.rev-opt.sel { border-color:var(--ouro); box-shadow:0 0 0 2px rgba(222,159,51,.25); }
.rev-opt:disabled { opacity:.5; cursor:not-allowed; }
.rev-passo { font-size:12px; letter-spacing:.14em; text-transform:uppercase; color:var(--ouro); font-weight:700; margin-bottom:6px; }
.rev-linha { display:flex; gap:10px; }
.rev-linha > * { flex:1; }
.rev-qtd { display:flex; align-items:center; gap:10px; margin-top:10px; }
.rev-qtd button { width:38px; height:38px; border-radius:10px; border:1px solid var(--borda); background:#fff; font-size:18px; cursor:pointer; }
.rev-codigo { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:22px; font-weight:700; letter-spacing:.05em; }
.rev-tl { list-style:none; padding:0; margin:0; }
.rev-tl li { position:relative; padding:0 0 16px 22px; border-left:2px solid var(--borda); }
.rev-tl li:last-child { border-left-color:transparent; padding-bottom:0; }
.rev-tl li::before { content:""; position:absolute; left:-7px; top:3px; width:12px; height:12px; border-radius:50%; background:var(--borda); }
.rev-tl li.ok::before { background:var(--ouro); }
.rev-mudo { font-size:13px; color:var(--suave); }
`;

type FotoLocal = { caminho: string; previa: string };
type Escolha = {
  quantidade: number;
  motivo?: string;
  comentario?: string;
  tamanho_desejado?: string;
  fotos: FotoLocal[];
};

const idItem = (i: ItemPedido) => String(i.tray_item_id);

function enderecoTexto(e?: Record<string, any>) {
  if (!e) return "";
  return [e.logradouro, e.numero, e.complemento, e.bairro, e.cidade, e.uf, e.cep]
    .filter(Boolean)
    .join(", ");
}

export default function TrocaDevolucao() {
  const [tela, setTela] = useState<"form" | "pronto" | "status">("form");
  const [passo, setPasso] = useState(1);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  const [pedido, setPedido] = useState("");
  const [identificador, setIdentificador] = useState("");
  const [dados, setDados] = useState<RespostaBuscar | null>(null);

  const [escolhas, setEscolhas] = useState<Record<string, Escolha>>({});
  const [preferencia, setPreferencia] = useState("");
  const [endereco, setEndereco] = useState<Record<string, string>>({});
  const [celular, setCelular] = useState("");
  const [email, setEmail] = useState("");
  const [observacao, setObservacao] = useState("");

  const [resultado, setResultado] = useState<RespostaCriar | null>(null);
  const [status, setStatus] = useState<RespostaStatus | null>(null);
  const [copiado, setCopiado] = useState(false);
  const topo = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = "Troca ou devolução | Use Mariana Cardoso";
  }, []);

  useEffect(() => {
    topo.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [passo, tela]);

  const itens = dados?.itens ?? [];
  const motivos = dados?.motivos ?? [];
  const selecionados = useMemo(
    () => itens.filter((i) => escolhas[idItem(i)]),
    [itens, escolhas],
  );

  const motivoDe = (codigo?: string): Motivo | undefined =>
    motivos.find((m) => chaveMotivo(m) === codigo);

  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    try {
      const r = await reversa<RespostaBuscar>({ acao: "buscar", pedido, identificador });
      setDados(r);
      setEscolhas({});
      setPreferencia("");
      setEndereco({ ...(r.endereco as Record<string, string>) });
      setCelular(r.cliente?.celular ?? r.cliente?.telefone ?? "");
      setEmail(r.cliente?.email ?? "");
      setPasso(2);
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }

  function alternarItem(item: ItemPedido) {
    const id = idItem(item);
    if ((item.disponivel ?? 1) < 1) return;
    setEscolhas((prev) => {
      const copia = { ...prev };
      if (copia[id]) delete copia[id];
      else copia[id] = { quantidade: 1, fotos: [] };
      return copia;
    });
  }

  function mudarEscolha(id: string, campo: Partial<Escolha>) {
    setEscolhas((p) => ({ ...p, [id]: { ...p[id], ...campo } }));
  }

  async function adicionarFotos(id: string, lista: FileList | null) {
    if (!lista?.length) return;
    setErro("");
    const atual = escolhas[id]?.fotos ?? [];
    const restante = 3 - atual.length;
    const arquivos = Array.from(lista).slice(0, Math.max(restante, 0));
    if (!arquivos.length) return;
    setCarregando(true);
    try {
      const novas: FotoLocal[] = [];
      for (const arquivo of arquivos) {
        const caminho = await enviarFoto(arquivo, pedido, identificador);
        novas.push({ caminho, previa: URL.createObjectURL(arquivo) });
      }
      mudarEscolha(id, { fotos: [...atual, ...novas] });
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }

  function validarMotivos() {
    for (const item of selecionados) {
      const id = idItem(item);
      const esc = escolhas[id];
      const m = motivoDe(esc?.motivo);
      if (!m) return "Escolha o motivo de cada peça para continuar.";
      if (m.pede_tamanho && !esc.tamanho_desejado?.trim())
        return "Diga qual tamanho você queria.";
      if (m.exige_foto && esc.fotos.length < 1)
        return "Envie ao menos uma foto da peça.";
    }
    return "";
  }

  async function enviar() {
    setErro("");
    if (!preferencia) return setErro("Escolha o que você prefere.");
    if (!celular.trim()) return setErro("Informe um celular com DDD para falarmos com você.");
    setCarregando(true);
    try {
      const r = await reversa<RespostaCriar>({
        acao: "criar",
        pedido,
        identificador,
        preferencia,
        itens: selecionados.map((item) => {
          const esc = escolhas[idItem(item)];
          return {
            tray_item_id: item.tray_item_id,
            quantidade: esc.quantidade,
            motivo: esc.motivo,
            comentario: esc.comentario || null,
            tamanho_desejado: esc.tamanho_desejado || null,
            fotos: esc.fotos.map((f) => f.caminho),
          };
        }),
        endereco,
        celular,
        email,
        observacao,
      });
      setResultado(r);
      salvarAcompanhamento(r.protocolo, r.token);
      setTela("pronto");
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }

  async function abrirStatus(protocolo?: string, token?: string) {
    const guardado = lerAcompanhamento();
    const p = protocolo ?? guardado.protocolo;
    const t = token ?? guardado.token;
    if (!p) return setErro("Não encontramos um pedido de troca salvo neste celular.");
    setErro("");
    setCarregando(true);
    try {
      const r = await reversa<RespostaStatus>({ acao: "status", protocolo: p, token: t });
      salvarAcompanhamento(p, t);
      setStatus(r);
      setTela("status");
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }

  const postagem = (tela === "status" ? status?.postagem : resultado?.postagem) ?? null;

  return (
    <div className="rev">
      <style>{CSS}</style>
      <div className="rev-wrap" ref={topo}>
        <header style={{ textAlign: "center", marginBottom: 20 }}>
          <h1>Troca ou devolução</h1>
          <p>Use Mariana Cardoso — é rápido e a postagem é por nossa conta.</p>
        </header>

        {erro && (
          <div className="rev-erro" role="alert">
            {erro}
          </div>
        )}

        {/* ══ Acompanhamento ══ */}
        {tela === "status" && (
          <>
            <div className="rev-card">
              <div className="rev-passo">Acompanhamento</div>
              <h2>Protocolo {status?.protocolo}</h2>
              <ul className="rev-tl" style={{ marginTop: 12 }}>
                {(status?.linha_do_tempo ?? status?.timeline ?? []).map((e, i) => (
                  <li key={i} className={e.concluido ? "ok" : ""}>
                    <strong>{e.rotulo ?? e.titulo}</strong>
                    <div className="rev-mudo">{formatarData(e.data)}</div>
                  </li>
                ))}
              </ul>
            </div>

            {!!status?.itens?.length && (
              <div className="rev-card">
                <h3>Peças</h3>
                {status.itens.map((it: any, i: number) => (
                  <div key={i} className="rev-item" style={{ marginTop: 10 }}>
                    {(it.foto || it.imagem) && (
                      <img className="rev-foto" src={it.foto || it.imagem} alt="" />
                    )}
                    <div>
                      <strong>{it.nome}</strong>
                      <div className="rev-mudo">
                        {[it.cor, it.tamanho].filter(Boolean).join(" · ")}
                      </div>
                      {it.motivo_rotulo && <div className="rev-mudo">{it.motivo_rotulo}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {postagem ? (
              <BlocoPostagem postagem={postagem} copiado={copiado} setCopiado={setCopiado} />
            ) : (
              status?.aviso && <div className="rev-aviso">{status.aviso}</div>
            )}

            <button
              className="rev-btn sec"
              onClick={() => {
                setTela("form");
                setStatus(null);
              }}
            >
              Voltar
            </button>
          </>
        )}

        {/* ══ Passo 5 — pronto ══ */}
        {tela === "pronto" && resultado && (
          <>
            <div className="rev-card" style={{ textAlign: "center" }}>
              <div className="rev-passo">Pronto</div>
              <h2>Recebemos seu pedido</h2>
              <p>Guarde este número para acompanhar:</p>
              <div className="rev-codigo">{resultado.protocolo}</div>
            </div>

            {postagem ? (
              <BlocoPostagem postagem={postagem} copiado={copiado} setCopiado={setCopiado} />
            ) : (
              (resultado.aviso || resultado.mensagem) && (
                <div className="rev-aviso">{resultado.aviso || resultado.mensagem}</div>
              )
            )}

            <button
              className="rev-btn"
              onClick={() => abrirStatus(resultado.protocolo, resultado.token)}
              disabled={carregando}
            >
              Acompanhar meu pedido
            </button>
          </>
        )}

        {/* ══ Passo 1 ══ */}
        {tela === "form" && passo === 1 && (
          <form className="rev-card" onSubmit={buscar}>
            <div className="rev-passo">Passo 1 de 4</div>
            <h2>Vamos achar sua compra</h2>
            <div style={{ marginTop: 14 }}>
              <label htmlFor="pedido">Número do pedido</label>
              <input
                id="pedido"
                type="text"
                inputMode="numeric"
                value={pedido}
                onChange={(e) => setPedido(e.target.value)}
                required
              />
            </div>
            <div style={{ marginTop: 14 }}>
              <label htmlFor="ident">CPF ou e-mail da compra</label>
              <input
                id="ident"
                type="text"
                value={identificador}
                onChange={(e) => setIdentificador(e.target.value)}
                required
              />
            </div>
            <button className="rev-btn" style={{ marginTop: 18 }} type="submit" disabled={carregando}>
              {carregando ? "Buscando..." : "Buscar meu pedido"}
            </button>
            <button
              type="button"
              className="rev-btn sec"
              style={{ marginTop: 10 }}
              onClick={() => abrirStatus()}
            >
              Já pedi uma troca, quero acompanhar
            </button>
          </form>
        )}

        {/* ══ Passo 2 ══ */}
        {tela === "form" && passo === 2 && dados && (
          <>
            {!!dados.solicitacoes?.length && (
              <div className="rev-aviso">
                <strong>Você já tem um pedido de troca deste pedido.</strong>
                {dados.solicitacoes.map((s) => (
                  <div key={s.protocolo} style={{ marginTop: 6 }}>
                    Protocolo {s.protocolo}{" "}
                    <button
                      type="button"
                      className="rev-opt"
                      style={{ display: "inline", border: "none", padding: 0, textDecoration: "underline", background: "none", width: "auto" }}
                      onClick={() => abrirStatus(s.protocolo, s.token)}
                    >
                      acompanhar
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="rev-card">
              <div className="rev-passo">Passo 2 de 4</div>
              <h2>Quais peças você quer devolver?</h2>
              <p>
                Compra de {formatarData(dados.data_compra)}
                {dados.cliente?.nome ? ` · ${dados.cliente.nome}` : ""}
              </p>
            </div>

            {itens.map((item) => {
              const id = idItem(item);
              const disp = item.disponivel ?? 1;
              const esc = escolhas[id];
              return (
                <div key={id} className={`rev-card ${esc ? "sel" : ""} ${disp < 1 ? "off" : ""}`}>
                  <button
                    type="button"
                    className="rev-item"
                    onClick={() => alternarItem(item)}
                    aria-pressed={!!esc}
                    disabled={disp < 1}
                  >
                    <img className="rev-foto" src={item.foto || item.imagem || ""} alt="" />
                    <span>
                      <strong>{item.nome}</strong>
                      <div className="rev-mudo" style={{ marginTop: 4 }}>
                        {[item.cor, item.tamanho].filter(Boolean).join(" · ")}
                      </div>
                      <div style={{ marginTop: 6, fontWeight: 600 }}>{moeda(item.valor)}</div>
                      {disp < 1 && <span className="rev-chip">já solicitado</span>}
                    </span>
                  </button>

                  {esc && disp > 1 && (
                    <div className="rev-qtd">
                      <span className="rev-mudo">Quantidade</span>
                      <button
                        type="button"
                        aria-label="Diminuir"
                        onClick={() => mudarEscolha(id, { quantidade: Math.max(1, esc.quantidade - 1) })}
                      >
                        −
                      </button>
                      <strong>{esc.quantidade}</strong>
                      <button
                        type="button"
                        aria-label="Aumentar"
                        onClick={() => mudarEscolha(id, { quantidade: Math.min(disp, esc.quantidade + 1) })}
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            <button
              className="rev-btn"
              disabled={!selecionados.length}
              onClick={() => {
                setErro("");
                setPasso(3);
              }}
            >
              Continuar
            </button>
            <button className="rev-btn sec" style={{ marginTop: 10 }} onClick={() => setPasso(1)}>
              Voltar
            </button>
          </>
        )}

        {/* ══ Passo 3 ══ */}
        {tela === "form" && passo === 3 && (
          <>
            <div className="rev-card">
              <div className="rev-passo">Passo 3 de 4</div>
              <h2>O que aconteceu com cada peça?</h2>
            </div>

            {selecionados.map((item) => {
              const id = idItem(item);
              const esc = escolhas[id];
              const m = motivoDe(esc.motivo);
              return (
                <div key={id} className="rev-card">
                  <h3>{item.nome}</h3>
                  <p className="rev-mudo">{[item.cor, item.tamanho].filter(Boolean).join(" · ")}</p>

                  <fieldset style={{ border: "none", padding: 0, margin: "10px 0 0" }}>
                    <legend className="rev-mudo" style={{ marginBottom: 8 }}>
                      Motivo
                    </legend>
                    {motivos.map((mo) => {
                      const cod = chaveMotivo(mo);
                      const bloqueado = mo.no_prazo === false;
                      return (
                        <button
                          key={cod}
                          type="button"
                          className={`rev-opt ${esc.motivo === cod ? "sel" : ""}`}
                          disabled={bloqueado}
                          aria-pressed={esc.motivo === cod}
                          onClick={() => mudarEscolha(id, { motivo: cod })}
                        >
                          {mo.rotulo}
                          {bloqueado && (
                            <div className="rev-mudo">prazo encerrado em {formatarData(mo.prazo_ate)}</div>
                          )}
                        </button>
                      );
                    })}
                  </fieldset>

                  {m?.pede_tamanho && (
                    <div style={{ marginTop: 12 }}>
                      <label htmlFor={`tam-${id}`}>Qual tamanho você queria?</label>
                      <input
                        id={`tam-${id}`}
                        type="text"
                        value={esc.tamanho_desejado ?? ""}
                        onChange={(e) => mudarEscolha(id, { tamanho_desejado: e.target.value })}
                      />
                    </div>
                  )}

                  {m?.exige_foto && (
                    <div style={{ marginTop: 12 }}>
                      <label htmlFor={`foto-${id}`}>Fotos da peça (de 1 a 3)</label>
                      <input
                        id={`foto-${id}`}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => {
                          adicionarFotos(id, e.target.files);
                          e.target.value = "";
                        }}
                      />
                      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                        {esc.fotos.map((f, i) => (
                          <div key={f.caminho} style={{ textAlign: "center" }}>
                            <img className="rev-mini" src={f.previa} alt={`Foto ${i + 1}`} />
                            <button
                              type="button"
                              className="rev-opt"
                              style={{ padding: "4px 8px", marginTop: 4, fontSize: 13 }}
                              onClick={() =>
                                mudarEscolha(id, { fotos: esc.fotos.filter((x) => x.caminho !== f.caminho) })
                              }
                            >
                              remover
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: 12 }}>
                    <label htmlFor={`obs-${id}`}>Quer contar mais alguma coisa? (opcional)</label>
                    <textarea
                      id={`obs-${id}`}
                      value={esc.comentario ?? ""}
                      onChange={(e) => mudarEscolha(id, { comentario: e.target.value })}
                    />
                  </div>
                </div>
              );
            })}

            <button
              className="rev-btn"
              onClick={() => {
                const problema = validarMotivos();
                if (problema) return setErro(problema);
                setErro("");
                setPasso(4);
              }}
            >
              Continuar
            </button>
            <button className="rev-btn sec" style={{ marginTop: 10 }} onClick={() => setPasso(2)}>
              Voltar
            </button>
          </>
        )}

        {/* ══ Passo 4 ══ */}
        {tela === "form" && passo === 4 && dados && (
          <>
            <div className="rev-card">
              <div className="rev-passo">Passo 4 de 4</div>
              <h2>O que você prefere?</h2>
              {(dados.preferencias ?? []).map((p) => {
                const cod = chavePreferencia(p);
                const troca = /troc/i.test(cod + (p.rotulo ?? ""));
                return (
                  <button
                    key={cod}
                    type="button"
                    className={`rev-opt ${preferencia === cod ? "sel" : ""}`}
                    style={{ padding: 16 }}
                    aria-pressed={preferencia === cod}
                    onClick={() => setPreferencia(cod)}
                  >
                    <strong style={{ fontSize: 16 }}>
                      {p.rotulo ?? (troca ? "Trocar por outra peça" : "Receber o valor de volta")}
                    </strong>
                    <div className="rev-mudo" style={{ marginTop: 6 }}>
                      {p.descricao ??
                        (troca
                          ? "Uma consultora fala com você pelo WhatsApp para escolher a nova peça e fazer o novo pedido."
                          : "Depois que a peça chegar e for conferida, devolvemos o valor.")}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="rev-card">
              <h3>Endereço para a coleta</h3>
              <div style={{ marginTop: 10 }}>
                <label htmlFor="cep">CEP</label>
                <input
                  id="cep"
                  type="text"
                  inputMode="numeric"
                  value={endereco.cep ?? ""}
                  onChange={(e) => setEndereco({ ...endereco, cep: e.target.value })}
                />
              </div>
              <div className="rev-linha" style={{ marginTop: 10 }}>
                <div style={{ flex: 3 }}>
                  <label htmlFor="rua">Rua</label>
                  <input
                    id="rua"
                    type="text"
                    value={endereco.logradouro ?? ""}
                    onChange={(e) => setEndereco({ ...endereco, logradouro: e.target.value })}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label htmlFor="num">Número</label>
                  <input
                    id="num"
                    type="text"
                    value={endereco.numero ?? ""}
                    onChange={(e) => setEndereco({ ...endereco, numero: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <label htmlFor="comp">Complemento</label>
                <input
                  id="comp"
                  type="text"
                  value={endereco.complemento ?? ""}
                  onChange={(e) => setEndereco({ ...endereco, complemento: e.target.value })}
                />
              </div>
              <div style={{ marginTop: 10 }}>
                <label htmlFor="bairro">Bairro</label>
                <input
                  id="bairro"
                  type="text"
                  value={endereco.bairro ?? ""}
                  onChange={(e) => setEndereco({ ...endereco, bairro: e.target.value })}
                />
              </div>
              <div className="rev-linha" style={{ marginTop: 10 }}>
                <div style={{ flex: 3 }}>
                  <label htmlFor="cidade">Cidade</label>
                  <input
                    id="cidade"
                    type="text"
                    value={endereco.cidade ?? ""}
                    onChange={(e) => setEndereco({ ...endereco, cidade: e.target.value })}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label htmlFor="uf">UF</label>
                  <input
                    id="uf"
                    type="text"
                    value={endereco.uf ?? ""}
                    onChange={(e) => setEndereco({ ...endereco, uf: e.target.value })}
                  />
                </div>
              </div>
              {enderecoTexto(dados.endereco) && (
                <p className="rev-mudo" style={{ marginTop: 10 }}>
                  Confira se está tudo certo. Você pode corrigir qualquer campo.
                </p>
              )}
            </div>

            <div className="rev-card">
              <h3>Como falamos com você</h3>
              <div style={{ marginTop: 10 }}>
                <label htmlFor="cel">Celular com DDD</label>
                <input
                  id="cel"
                  type="tel"
                  inputMode="tel"
                  value={celular}
                  onChange={(e) => setCelular(e.target.value)}
                  required
                />
              </div>
              <div style={{ marginTop: 10 }}>
                <label htmlFor="mail">E-mail</label>
                <input id="mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div style={{ marginTop: 10 }}>
                <label htmlFor="obsg">Alguma observação? (opcional)</label>
                <textarea id="obsg" value={observacao} onChange={(e) => setObservacao(e.target.value)} />
              </div>
            </div>

            <div className="rev-aviso">
              A postagem é por nossa conta. Você leva a peça em qualquer agência dos Correios, sem pagar
              nada e sem imprimir etiqueta.
            </div>

            <button className="rev-btn" onClick={enviar} disabled={carregando}>
              {carregando ? "Enviando..." : "Enviar pedido"}
            </button>
            <button className="rev-btn sec" style={{ marginTop: 10 }} onClick={() => setPasso(3)}>
              Voltar
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function BlocoPostagem({
  postagem,
  copiado,
  setCopiado,
}: {
  postagem: NonNullable<RespostaCriar["postagem"]>;
  copiado: boolean;
  setCopiado: (v: boolean) => void;
}) {
  return (
    <div className="rev-card">
      <h3>Como postar a peça</h3>
      <p style={{ marginBottom: 4 }}>Código de autorização dos Correios:</p>
      <div className="rev-codigo">{postagem.codigo_autorizacao}</div>
      <button
        className="rev-btn sec"
        style={{ marginTop: 10 }}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(postagem.codigo_autorizacao ?? "");
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2000);
          } catch {
            setCopiado(false);
          }
        }}
      >
        {copiado ? "Copiado!" : "Copiar código"}
      </button>
      <p className="rev-mudo" style={{ marginTop: 10 }}>
        Válido até {formatarData(postagem.valido_ate)}
        {postagem.servico ? ` · ${postagem.servico}` : ""}
      </p>
      <ol style={{ paddingLeft: 18, lineHeight: 1.7, color: "#6B6659" }}>
        <li>Coloque a peça na embalagem, com etiqueta e sem uso.</li>
        <li>Vá a qualquer agência dos Correios e informe o código.</li>
        <li>Guarde o comprovante de postagem.</li>
      </ol>
    </div>
  );
}
