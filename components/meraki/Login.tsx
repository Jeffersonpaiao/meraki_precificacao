'use client';
import {Modal} from './ui';
import type {Data} from '../../lib/domain';
export type Cloud={token:string;clinicId:string;role:string;revision:number};
export default function Login({close}:{cloud:Cloud|null;close:()=>void;onConnected:(d:Data,c:Cloud)=>void;onLogout:()=>void}){return <Modal title="Acesso à clínica" onClose={close}><p>Entre no portal para acessar os dados compartilhados da sua clínica.</p><a className="primary" href="/">Acessar portal</a><p className="footnote">Os dados da demonstração permanecem separados dos dados de produção.</p></Modal>;}
