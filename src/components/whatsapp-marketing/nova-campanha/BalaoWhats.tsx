/** Balão de mensagem no estilo WhatsApp, igual ao preview das outras telas. */
export function BalaoWhats({
  texto, botoes, nome,
}: { texto: string; botoes?: { type?: string; text?: string }[]; nome?: string }) {
  return (
    <div className="space-y-1">
      {nome && <p className="text-xs font-medium">{nome}</p>}
      <div className="rounded-xl bg-[#0b141a] p-3">
        <div className="max-w-[320px] rounded-lg rounded-tl-none bg-[#005c4b] p-2.5 text-sm text-white">
          <p className="whitespace-pre-wrap break-words">{texto || "Sem texto"}</p>
          {(botoes ?? []).length > 0 && (
            <div className="mt-2 space-y-1 border-t border-white/20 pt-2">
              {(botoes ?? []).map((b, i) => (
                <div key={i} className="rounded bg-white/10 px-2 py-1 text-center text-xs text-white/90">
                  {b.text || "Botão"}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default BalaoWhats;
