'use client';
import {useState} from 'react';
import type {Data,Supply} from '../../lib/domain';
import {readSupplies,supplyTemplate} from '../../lib/supply-import';
import {download} from '../../lib/reports';
import {money} from '../../lib/finance';
import {Modal} from './ui';
import type {Save} from './Records';
export default function SupplyImport({data,save,close}:{data:Data;save:Save;close:()=>void}){
 const [rows,setRows]=useState<Supply[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[filename,setFilename]=useState('');
 async function run(fn:()=>Promise<void>){setBusy(true);setError('');try{await fn();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <Modal title="Importar insumos em lote" onClose={()=>{if(!busy)close();}}><p>Baixe o modelo, preencha os insumos e selecione a planilha. Os dados serão salvos somente após sua confirmação.</p><button className="secondary" disabled={busy} onClick={()=>run(async()=>download(await supplyTemplate(),'modelo-insumos-meraki.xlsx'))}>Baixar modelo Excel</button><p className="footnote">Formato .xlsx · até 5 MB · até 2.000 insumos por arquivo. Somente novos cadastros: códigos existentes ou repetidos bloqueiam a importação.</p><label>Planilha de insumos<input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={busy} onChange={e=>{const file=e.target.files?.[0];e.target.value='';setRows([]);setFilename('');if(file)void run(async()=>{const parsed=await readSupplies(file,data.supplies);setRows(parsed);setFilename(file.name);});}}/></label>{busy&&<p role="status">Processando…</p>}{error&&<p className="notice danger" role="alert">{error}</p>}{rows.length>0&&<><p role="status"><strong>{rows.length} insumos válidos</strong> em {filename}. Confira a prévia dos primeiros {Math.min(rows.length,20)} itens.</p><div className="table-wrap"><table><thead><tr><th>Código</th><th>Nome</th><th>Conteúdo</th><th>Preço</th></tr></thead><tbody>{rows.slice(0,20).map(s=><tr key={s.id}><td>{s.code}</td><td>{s.name}</td><td>{s.pack} {s.unit}</td><td>{money(s.price)}</td></tr>)}</tbody></table></div><button className="primary" disabled={busy} onClick={()=>run(async()=>{await save({...data,supplies:[...data.supplies,...rows]},'Importação de insumos',`${rows.length} novos insumos`);close();})}>Confirmar importação de {rows.length} insumos</button></>}<button className="secondary" disabled={busy} onClick={close}>Cancelar</button></Modal>;
}
