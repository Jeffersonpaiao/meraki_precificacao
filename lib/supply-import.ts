import type {Supply} from './domain.ts';
import {emptySupply} from './seed.ts';
import {dataSchema} from './validation.ts';
import {emptyData} from './seed.ts';

export const supplyHeaders=['codigo','nome','categoria','descricao','marca','fornecedor','unidade_compra','conteudo','unidade','preco','frete','tributos','desconto','perda_percentual','validade','estoque','estoque_minimo'];
type Cell=string|number|Date|null;
export function parseSupplies(rows:Cell[][],existing:Supply[]):Supply[]{
 if(rows.length<2)throw new Error('A planilha está vazia. Preencha o modelo antes de importar.');
 if(rows.length>2001)throw new Error('Importe no máximo 2.000 linhas por arquivo.');
 supplyHeaders.forEach((h,i)=>{if(String(rows[0][i]??'').trim().toLowerCase()!==h)throw new Error(`Coluna ${i+1}: esperado “${h}”. Utilize o modelo Excel.`);});
 const codes=new Set(existing.map(s=>s.code.trim().toLowerCase()));const result:Supply[]=[];
 rows.slice(1).forEach((row,index)=>{
  if(row.every(v=>v===null||String(v).trim()===''))return;
  const line=index+2;
  const text=(i:number)=>String(row[i]??'').trim();
  const number=(i:number,required=false)=>{const raw=row[i];if(raw===null||raw===undefined||text(i)===''){if(required)throw new Error(`Linha ${line}: preencha ${supplyHeaders[i]}.`);return 0;}let value:number;if(typeof raw==='number')value=raw;else{let str=text(i);if(!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d+)?$/.test(str)&&!/^\d+(?:\.\d+)?$/.test(str))throw new Error(`Linha ${line}: ${supplyHeaders[i]} deve ser um número positivo, sem R$ ou %.`);if(str.includes(','))str=str.replace(/\./g,'').replace(',','.');value=Number(str);}if(!Number.isFinite(value)||value<0)throw new Error(`Linha ${line}: ${supplyHeaders[i]} inválido.`);return value;};
  const code=text(0);if(codes.has(code.toLowerCase()))throw new Error(`Linha ${line}: código “${code}” duplicado na planilha ou já cadastrado. Nenhum item foi importado.`);codes.add(code.toLowerCase());
  let expiry=text(14);if(row[14] instanceof Date)expiry=row[14].toISOString().slice(0,10);else if(/^\d{2}\/\d{2}\/\d{4}$/.test(expiry))expiry=expiry.split('/').reverse().join('-');
  const units:Record<string,Supply['unit']>={un:'un',ml:'mL',l:'L',g:'g',kg:'kg'};const unit=units[text(8).toLowerCase()];if(!unit)throw new Error(`Linha ${line}: unidade deve ser un, mL, L, g ou kg.`);
  const s:Supply={...emptySupply(),code,name:text(1),category:text(2),description:text(3),brand:text(4),supplier:text(5),purchaseUnit:text(6)||'Embalagem',pack:number(7,true),unit,price:number(9,true),freight:number(10),tax:number(11),discount:number(12),loss:number(13),expiry,stock:number(15),minimum:number(16)};
  const check=dataSchema.safeParse({...emptyData(),supplies:[s]});if(!check.success)throw new Error(`Linha ${line}: revise ${check.error.issues.map(i=>`${i.path.slice(2).join('.')||'valores'} (${i.message})`).join('; ')}`);
  result.push(s);
 });
 if(!result.length)throw new Error('Nenhum insumo preenchido na planilha.');
 if(existing.length+result.length>10000)throw new Error('O total de insumos não pode ultrapassar 10.000.');
 return result;
}
export async function readSupplies(file:File,existing:Supply[]){
 if(!file.name.toLowerCase().endsWith('.xlsx'))throw new Error('Selecione uma planilha Excel no formato .xlsx.');
 if(file.size>5_000_000)throw new Error('O arquivo deve ter até 5 MB.');
 const {default:ExcelJS}=await import('exceljs');const workbook=new ExcelJS.Workbook();
 try{await workbook.xlsx.load(await file.arrayBuffer());}catch{throw new Error('Não foi possível ler a planilha. Salve como .xlsx e tente novamente.');}
 const sheet=workbook.getWorksheet('Insumos')??workbook.worksheets[0];
 if(!sheet||sheet.rowCount>2001)throw new Error('Planilha ausente ou com mais de 2.000 linhas.');
 const rows:Cell[][]=[];
 for(let r=1;r<=sheet.rowCount;r++){const row:Cell[]=[];for(let c=1;c<=supplyHeaders.length;c++){const cell=sheet.getCell(r,c),v=cell.value;if(v!==null&&typeof v==='object'&&!(v instanceof Date))throw new Error(`Linha ${r}, coluna ${c}: use valores simples, sem fórmulas ou links.`);row.push(v as Cell);}rows.push(row);}
 return parseSupplies(rows,existing);
}
export async function supplyTemplate(){
 const {default:ExcelJS}=await import('exceljs');const w=new ExcelJS.Workbook();const s=w.addWorksheet('Insumos');s.addRow(supplyHeaders);s.views=[{state:'frozen',ySplit:1}];s.columns.forEach(c=>c.width=22);s.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};s.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF166657'}};
 const help=w.addWorksheet('Instruções');[
 'Preencha a aba Insumos; não altere os cabeçalhos.',
 'Obrigatórios: codigo, nome, conteudo, unidade, preco. Código deve ser único; use texto para preservar zeros à esquerda.',
 'Unidades: un, mL, L, g, kg. Conteúdo é a quantidade por embalagem, maior que zero.',
 'Preço, frete, tributos e desconto são valores por embalagem em reais. Não digite R$.',
 'Perda percentual: digite 5 para 5%; não formate a célula como porcentagem. Deve ser menor que 100.',
 'Validade: data Excel, DD/MM/AAAA ou AAAA-MM-DD; pode ficar vazia.',
 'Estoque e estoque mínimo: quantidades de embalagens. Números opcionais vazios serão zero.',
 'Somente novos insumos. Códigos já cadastrados ou duplicados bloqueiam o lote inteiro.',
 'Limites: 2.000 linhas por arquivo, 5 MB. Revise a prévia e confirme para salvar.',
 'Exemplo (não incluído para importação): codigo INS-001; nome Luvas; conteudo 100; unidade un; preco 45,90.'
 ].forEach(t=>help.addRow([t]));help.getColumn(1).width=110;help.eachRow(r=>{r.alignment={wrapText:true};r.height=35;});
 return new Blob([await w.xlsx.writeBuffer() as ArrayBuffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
