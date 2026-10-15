import type { Supply, Unit, Procedure, Settings, TaxRule, Result, Reference } from './domain.ts';
const units:Record<Unit,{family:string;factor:number}> = {un:{family:'count',factor:1},mL:{family:'volume',factor:1},L:{family:'volume',factor:1000},g:{family:'mass',factor:1},kg:{family:'mass',factor:1000}};
export const money=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);
export const percent=(v:number)=>`${v.toLocaleString('pt-BR',{maximumFractionDigits:1})}%`;
export function validNumber(value:number,label:string,min=0,max=Number.MAX_SAFE_INTEGER){ if(!Number.isFinite(value)||value<min||value>max)throw new Error(`${label}: informe um número entre ${min} e ${max}.`);return value; }
export function convert(quantity:number,from:Unit,to:Unit){ validNumber(quantity,'Quantidade');if(!units[from]||!units[to]||units[from].family!==units[to].family)throw new Error('Conversão entre unidades incompatíveis.');return quantity*units[from].factor/units[to].factor; }
export function unitCost(s:Supply){validNumber(s.pack,'Conteúdo da embalagem',0.000001);[s.price,s.freight,s.tax,s.discount].forEach(n=>validNumber(n,'Aquisição'));const total=s.price+s.freight+s.tax-s.discount;if(total<0)throw new Error('Desconto maior que o custo de aquisição.');return total/s.pack;}
export function itemCost(s:Supply,quantity:number,unit:Unit,loss:number){validNumber(loss,'Perda',0,99.99);return unitCost(s)*convert(quantity,unit,s.unit)/(1-loss/100);}
export function activeTaxes(p:Procedure,rules:TaxRule[],date:string){return rules.filter(t=>p.taxIds.includes(t.id)&&t.start<=date&&(!t.end||t.end>=date)&&(!t.category||t.category===p.category));}
export function calculate(p:Procedure,supplies:Supply[],rules:TaxRule[],settings:Settings,date=new Date().toISOString().slice(0,10),mode:'margin'|'price'='price'):Result{
  const numeric=[p.minutes,p.hourly,p.burden,p.assistant,p.depreciation,p.maintenance,p.energy,p.rental,p.room,p.cleaning,p.sterilization,p.waste,p.other,p.price];numeric.forEach(n=>validNumber(n,'Custo/tempo'));
  [p.commission,p.card,p.target].forEach(n=>validNumber(n,'Percentual',0,100));
  validNumber(settings.capacity,'Capacidade mensal',0.000001);
  const materials=p.items.reduce((sum,i)=>{const s=supplies.find(s=>s.id===i.supplyId);if(!s)throw new Error('Insumo vinculado não encontrado.');return sum+itemCost(s,i.quantity,i.unit,i.loss);},0);
  const labor=p.hourly*p.minutes/60*(1+p.burden/100)+p.assistant;
  const equipment=p.depreciation+p.maintenance+p.energy+p.rental;
  const other=p.room+p.cleaning+p.sterilization+p.waste+p.other;
  const variable=materials+labor+equipment+other;
  const fixed=settings.fixed.reduce((s,f)=>s+validNumber(f.amount,'Despesa fixa'),0)/settings.capacity*(settings.driver==='hours'?p.minutes/60:1);
  const operatingCost=variable+fixed;
  const taxes=activeTaxes(p,rules,date);taxes.forEach(t=>validNumber(t.rate,'Alíquota',0,99.99));
  const revenueTaxRate=taxes.filter(t=>t.base==='revenue').reduce((s,t)=>s+t.rate/100,0);
  const profitRate=taxes.filter(t=>t.base==='profit').reduce((s,t)=>s+t.rate/100,0);
  const commercialRate=(p.commission+p.card)/100,revenueRate=revenueTaxRate+commercialRate;
  if(revenueRate>=1||profitRate>=1)throw new Error('Soma das alíquotas e taxas deve ser inferior a 100% em cada base.');
  const divisor=1-revenueRate-p.target/100/(1-profitRate);
  const suggested=divisor<=0?null:operatingCost/divisor;
  const minimum=operatingCost/(1-revenueRate);
  const price=mode==='margin'?(suggested??p.price):p.price;
  const revenueTax=price*revenueTaxRate,commercial=price*commercialRate;
  const contribution=price-variable-revenueTax-commercial;
  const operatingProfit=contribution-fixed,profitTax=Math.max(0,operatingProfit)*profitRate,net=operatingProfit-profitTax;
  return {materials,labor,equipment,other,variable,fixed,operatingCost,revenueRate,profitRate,suggested,minimum,price,revenueTax,commercial,profitTax,contribution,operatingProfit,net,contributionMargin:price?contribution/price*100:0,operatingMargin:price?operatingProfit/price*100:0,netMargin:price?net/price*100:0,markup:operatingCost?price/operatingCost:null,total:operatingCost+revenueTax+commercial+profitTax,taxDetails:taxes.map(t=>({name:t.name,base:t.base,rate:t.rate,amount:t.rate/100*(t.base==='revenue'?price:Math.max(0,operatingProfit))}))};
}
export function simulate(p:Procedure,supplies:Supply[],taxes:TaxRule[],settings:Settings,args:{volume:number;discount:number;inflation:number;price:number;minutes:number;commission:number;taxDelta:number},date?:string){
 validNumber(args.volume,'Volume',0);validNumber(args.discount,'Desconto',0,100);validNumber(args.inflation,'Variação dos insumos',-100,1000);
 const adjusted={...p,price:args.price*(1-args.discount/100),minutes:args.minutes,commission:args.commission};
 const adjustedSupplies=supplies.map(s=>({...s,price:s.price*(1+args.inflation/100),freight:s.freight*(1+args.inflation/100),tax:s.tax*(1+args.inflation/100),discount:s.discount*(1+args.inflation/100)}));
 const extra:TaxRule={id:'scenario',name:'Acréscimo de tributos do cenário',regime:'Personalizado',base:'revenue',rate:args.taxDelta,start:'2000-01-01',end:'',source:'Simulação',category:''};
 adjusted.taxIds=[...adjusted.taxIds,'scenario'];
 const r=calculate(adjusted,adjustedSupplies,[...taxes,extra],settings,date);
 const fixed=settings.fixed.reduce((s,f)=>s+f.amount,0),revenue=r.price*args.volume,contribution=r.contribution*args.volume,operating=contribution-fixed,profitTax=Math.max(0,operating)*r.profitRate;
 const breakEven=r.contribution>0?fixed/r.contribution:null;
 return {unit:r,revenue,variable:(r.variable+r.revenueTax+r.commercial)*args.volume,contribution,fixed,operating,profitTax,net:operating-profitTax,breakEven,safety:breakEven!==null&&args.volume?(args.volume-breakEven)/args.volume*100:null};
}
export function market(procedure:Procedure,refs:Reference[],settings:Settings){const valid=refs.filter(r=>r.procedureId===procedure.id&&r.comparable&&r.sessions===procedure.sessions&&r.price>0&&r.source.trim()&&r.date).sort((a,b)=>a.price-b.price);const n=valid.length;if(n<settings.minimumReferences)return {count:n,reliable:false as const};const median=n%2?valid[(n-1)/2].price:(valid[n/2-1].price+valid[n/2].price)/2;const delta=(procedure.price/median-1)*100;return {count:n,reliable:true as const,min:valid[0].price,max:valid[n-1].price,mean:valid.reduce((s,r)=>s+r.price,0)/n,median,delta,position:Math.abs(delta)<=settings.tolerance?'Próximo ao mercado':delta<0?'Abaixo do mercado':'Acima do mercado'};}
