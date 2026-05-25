import { useState } from "react"
import {
  LogIn, LayoutDashboard, ClipboardList, FileText, Plus, Search,
  Filter, LogOut, ChevronRight, AlertTriangle, CheckCircle2,
  Camera, FileSignature, CreditCard, Scissors, Truck, X, Eye,
  Upload, User, Calendar, Package, CheckCheck, Circle, ArrowRight,
  Banknote, Image, FilePlus, Edit3, RefreshCw, MapPin, StickyNote,
  CheckSquare, Square, Layers, Settings, Menu, Ruler, Pencil,
  Trash2, Monitor, Smartphone, Grid, ChevronDown, BookOpen
} from "lucide-react"
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart } from "recharts"

/* ══════════════════════════════════════════
   STYLES
══════════════════════════════════════════ */
const G = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    :root{
      --a:#0EA5E9;--ad:#0284C7;--al:#E0F2FE;--am:#BAE6FD;
      --bg:#F0F4F8;--card:#fff;--border:#E2E8F0;--borderl:#F1F5F9;
      --t1:#0F172A;--t2:#475569;--t3:#94A3B8;
      --ok:#16A34A;--ok-bg:#DCFCE7;--ok-b:#BBF7D0;
      --warn:#D97706;--warn-bg:#FEF3C7;--warn-b:#FDE68A;
      --err:#DC2626;--err-bg:#FEE2E2;--err-b:#FECACA;
      --pur:#7C3AED;--pur-bg:#EDE9FE;
      --r:10px;--rl:14px;
      --sh:0 1px 3px rgba(15,23,42,.07),0 1px 2px rgba(15,23,42,.04);
      --sidebar:220px;--maxw:860px;
    }
    html,body{font-family:'DM Sans',-apple-system,sans-serif;background:var(--bg);color:var(--t1);font-size:14px;line-height:1.5}
    button{font-family:inherit;cursor:pointer}input,select,textarea{font-family:inherit}
    ::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}

    .btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:10px 18px;border-radius:var(--r);border:none;font-size:14px;font-weight:500;transition:all .15s;line-height:1;white-space:nowrap}
    .btn-primary{background:var(--a);color:#fff}.btn-primary:hover{background:var(--ad);box-shadow:0 4px 12px rgba(14,165,233,.3)}
    .btn-secondary{background:var(--card);color:var(--t1);border:1px solid var(--border)}.btn-secondary:hover{background:var(--bg)}
    .btn-ghost{background:transparent;color:var(--t2);border:1px solid transparent}.btn-ghost:hover{background:var(--bg)}
    .btn-danger{background:var(--err-bg);color:var(--err)}.btn-danger:hover{background:var(--err-b)}
    .btn-success{background:var(--ok-bg);color:var(--ok)}.btn-success:hover{background:var(--ok-b)}
    .btn-warn{background:var(--warn-bg);color:var(--warn)}
    .btn-full{width:100%}.btn-sm{padding:6px 12px;font-size:12px}.btn-lg{padding:13px 24px;font-size:15px}
    .btn-icon{padding:8px}

    .card{background:var(--card);border-radius:var(--rl);border:1px solid var(--border);box-shadow:var(--sh)}
    .input{width:100%;padding:10px 14px;border-radius:var(--r);border:1.5px solid var(--border);background:#F8FAFC;font-size:14px;color:var(--t1);outline:none;transition:border .15s,box-shadow .15s}
    .input:focus{border-color:var(--a);background:#fff;box-shadow:0 0 0 3px rgba(14,165,233,.1)}
    .input::placeholder{color:var(--t3)}
    .select{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:32px}
    .textarea{resize:vertical;min-height:70px;padding:10px 14px;border-radius:var(--r);border:1.5px solid var(--border);background:#F8FAFC;font-size:13px;width:100%;outline:none;transition:border .15s}
    .textarea:focus{border-color:var(--a);background:#fff}

    .badge{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:20px;font-size:11px;font-weight:600;white-space:nowrap}
    .b-new{background:#E0F2FE;color:#0369A1}.b-inwork{background:#DBEAFE;color:#1D4ED8}
    .b-prod{background:#EDE9FE;color:#6D28D9}.b-ready{background:#DCFCE7;color:#15803D}
    .b-install{background:#E0E7FF;color:#3730A3}.b-payment{background:#FEF3C7;color:#B45309}
    .b-done{background:#D1FAE5;color:#065F46}.b-cancel{background:#FEE2E2;color:#B91C1C}
    .b-mat-no{background:#FEE2E2;color:#B91C1C}.b-mat-part{background:#FEF3C7;color:#B45309}.b-mat-yes{background:#DCFCE7;color:#15803D}
    .b-overdue{background:#FEE2E2;color:#B91C1C;border:1px solid var(--err-b)}
    .b-draft{background:#F1F5F9;color:#475569}

    .top-nav{background:var(--card);border-bottom:1px solid var(--border)}
    .nav-tab{padding:11px 15px;font-size:13px;font-weight:500;color:var(--t2);border:none;background:none;border-bottom:2px solid transparent;margin-bottom:-1px;transition:all .15s;white-space:nowrap;display:inline-flex;align-items:center;gap:5px}
    .nav-tab:hover{color:var(--t1)}.nav-tab.active{color:var(--a);border-bottom-color:var(--a)}

    .tbl{width:100%;border-collapse:collapse}
    .tbl th{padding:9px 14px;text-align:left;font-size:11px;font-weight:600;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid var(--border);background:#FAFBFC}
    .tbl td{padding:11px 14px;font-size:13px;border-bottom:1px solid var(--borderl);vertical-align:middle}
    .tbl tr:last-child td{border-bottom:none}.tbl tr:hover td{background:#F8FAFC}

    .prog{height:6px;border-radius:3px;background:var(--border);overflow:hidden}
    .prog-f{height:100%;border-radius:3px;transition:width .4s}
    .slbl{font-size:11px;font-weight:600;color:var(--t3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px}
    .divider{height:1px;background:var(--border);margin:14px 0}
    .oli{padding:13px 16px;border-bottom:1px solid var(--borderl);cursor:pointer;transition:background .1s}
    .oli:last-child{border-bottom:none}.oli:hover{background:#F8FAFC}
    .blocker{display:flex;align-items:flex-start;gap:10px;padding:10px 14px;background:#FFF7ED;border:1px solid #FED7AA;border-radius:var(--r);margin-bottom:6px;font-size:13px;color:#92400E}
    .chip{padding:6px 12px;border-radius:20px;font-size:12px;font-weight:500;border:1px solid var(--border);background:var(--card);color:var(--t2);white-space:nowrap}
    .chip.act{background:var(--a);color:#fff;border-color:var(--a)}
    .modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:300;padding:16px}
    .modal{background:var(--card);border-radius:16px;width:100%;max-width:440px;box-shadow:0 24px 64px rgba(15,23,42,.18)}
    .step-dot{width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .sd-done{background:var(--ok-bg);color:var(--ok)}.sd-act{background:var(--al);color:var(--a)}.sd-pend{background:var(--bg);color:var(--t3);border:1px solid var(--border)}
    .ig{display:flex;flex-direction:column;gap:5px;margin-bottom:12px}
    .ig label{font-size:12px;font-weight:500;color:var(--t2)}
    .ig2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .empty-st{display:flex;flex-direction:column;align-items:center;padding:40px 20px;text-align:center}
    .st-dot{width:16px;height:16px;border-radius:50%;flex-shrink:0}
    .std-ok{background:#16A34A;box-shadow:0 0 0 3px #DCFCE7}
    .std-warn{background:#F59E0B;box-shadow:0 0 0 3px #FEF3C7}
    .std-err{background:#DC2626;box-shadow:0 0 0 3px #FEE2E2}
    .std-gray{background:#94A3B8;box-shadow:0 0 0 3px #F1F5F9}
    .overlay-panel{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:200;display:flex;justify-content:flex-end}
    .overlay-inner{background:var(--card);width:min(380px,100vw);height:100%;overflow-y:auto;box-shadow:-8px 0 32px rgba(15,23,42,.12)}

    /* SCREEN MAP */
    .screen-map{position:fixed;top:0;left:0;right:0;bottom:0;background:var(--bg);z-index:500;overflow-y:auto;padding:20px}
    .sm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-top:16px}
    .sm-card{background:var(--card);border:2px solid var(--border);border-radius:var(--rl);padding:16px;cursor:pointer;transition:all .15s;display:flex;flex-direction:column;gap:8px}
    .sm-card:hover{border-color:var(--a);box-shadow:0 4px 16px rgba(14,165,233,.15);transform:translateY(-2px)}
    .sm-role{font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;display:inline-block}
    .sm-route{font-size:10px;color:var(--t3);font-family:monospace}
    .sm-num{font-size:10px;color:var(--t3);font-weight:600}

    /* APP */
    .app-shell{display:flex;min-height:100vh}
    .sidebar{width:var(--sidebar);background:var(--card);border-right:1px solid var(--border);display:flex;flex-direction:column;position:fixed;top:0;left:0;height:100vh;z-index:50;transform:translateX(-100%);transition:transform .2s}
    .sidebar.open{transform:translateX(0)}
    .sidebar-logo{padding:16px 14px 12px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:9px}
    .sidebar-logo-icon{width:32px;height:32px;border-radius:8px;background:var(--a);display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .sidebar-nav{flex:1;padding:10px 8px;overflow-y:auto}
    .sidebar-item{display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:var(--r);font-size:13px;font-weight:500;color:var(--t2);cursor:pointer;transition:all .12s;border:none;background:none;width:100%;text-align:left}
    .sidebar-item:hover{background:var(--bg)}.sidebar-item.active{background:var(--al);color:var(--a)}
    .sidebar-footer{padding:10px;border-top:1px solid var(--border)}
    .main-content{flex:1;min-width:0}
    .mobile-topbar{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--card);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:40}
    .mobile-bottom-nav{display:flex;background:var(--card);border-top:1px solid var(--border);position:fixed;bottom:0;left:0;right:0;z-index:50;padding:6px 0 max(6px,env(safe-area-inset-bottom))}
    .mbn-item{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;padding:4px 0;cursor:pointer;border:none;background:none;color:var(--t3);font-size:10px;font-weight:500;transition:color .12s}
    .mbn-item.active{color:var(--a)}
    .sidebar-overlay{position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:49;display:none}
    .sidebar-overlay.show{display:block}
    .cwrap{padding:20px;max-width:var(--maxw);margin:0 auto}

    @media(min-width:768px){
      .mobile-topbar{display:none}.mobile-bottom-nav{display:none}
      .sidebar{transform:translateX(0)}.main-content{margin-left:var(--sidebar)}
      .sidebar-overlay{display:none!important}
      .dg2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
      .dg3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
    }
    @media(max-width:767px){
      .cwrap{padding:12px 14px 80px}
      .dg2,.dg3{display:flex;flex-direction:column;gap:10px}
    }
  `}</style>
)

/* ══ DATA ══ */
const chartData = [
  {m:"Сен",p:1.2,r:3.8},{m:"Окт",p:2.1,r:5.2},{m:"Ноя",p:1.8,r:4.5},
  {m:"Дек",p:3.4,r:7.8},{m:"Янв",p:4.1,r:8.9},{m:"Фев",p:3.8,r:8.2},
]
const ordersData = [
  {id:1,client:"Ахметов", date:"01.04.26",designer:"Ибраева", status:"b-prod",   sl:"В производстве",mat:"b-mat-part",ml:"Частично",  overdue:false,sewSt:"problem",wrhSt:"warning",instSt:"ok", total:331000,paid:500000},
  {id:2,client:"Серик",   date:"03.04.26",designer:"Калиева", status:"b-inwork", sl:"В работе",       mat:"b-mat-no",  ml:"Не готовы", overdue:false,sewSt:"ok",    wrhSt:"problem",instSt:"ok", total:580000,paid:290000},
  {id:3,client:"Каримов", date:"15.04.26",designer:"Калиева", status:"b-ready",  sl:"Готов",          mat:"b-mat-yes", ml:"Готовы",    overdue:true, sewSt:"ok",    wrhSt:"ok",     instSt:"ok", total:420000,paid:420000},
  {id:4,client:"Серик",   date:"17.04.26",designer:"Ибраева", status:"b-payment",sl:"Ожидает оплату", mat:"b-mat-yes", ml:"Готовы",    overdue:false,sewSt:"ok",    wrhSt:"warning",instSt:"ok", total:960000,paid:480000},
  {id:5,client:"Садыков", date:"21.04.26",designer:"Ибраева", status:"b-new",    sl:"Новый",          mat:"b-mat-no",  ml:"Не готовы", overdue:false,sewSt:"problem",wrhSt:"problem",instSt:"ok",total:0,     paid:0},
]
const measurements = [
  {id:1,room:"Гостиная",window:"Окно 1",w:100,h:150,fabric:"Блэкаут",fm:3,tulle:"Лен",tm:3,mount:"Потолочный",comment:"Клиент хочет серый тон",price:86000},
  {id:2,room:"Гостиная",window:"Окно 2",w:100,h:150,fabric:"Блэкаут",fm:3,tulle:"",  tm:0,mount:"Настенный",  comment:"",                     price:78000},
  {id:3,room:"Спальня", window:"Окно 1",w:200,h:200,fabric:"Шёлк",   fm:5,tulle:"Вуаль",tm:4,mount:"Потолочный",comment:"2 шт, спаренный карниз",price:182000,qty:2},
]
const quoteItems = [
  {id:1,room:"Гостиная",window:"Окно 1 [100×150]",fabric:"Блэкаут",fc:45000,tulle:"Лен",  tc:18000,sewing:12000,cornice:8000,install:3000,total:86000},
  {id:2,room:"Гостиная",window:"Окно 2 [100×150]",fabric:"Блэкаут",fc:40000,tulle:"",     tc:0,    sewing:12000,cornice:8000,install:3000,total:63000},
  {id:3,room:"Спальня", window:"Окно 1 [200×200]",fabric:"Шёлк",   fc:98000,tulle:"Вуаль",tc:32000,sewing:24000,cornice:18000,install:5000,total:182000,qty:2},
]
const prodItems = [
  {id:1,room:"Гостиная",window:"Окно 1 [100×150]",fabric:"Блэкаут",tulle:"Лен",  sew:"Классическая шторная лента",done:true},
  {id:2,room:"Гостиная",window:"Окно 2 [100×150]",fabric:"Блэкаут",tulle:"",     sew:"Классическая шторная лента",done:false},
  {id:3,room:"Спальня", window:"Окно 1 [200×200]",fabric:"Шёлк",   tulle:"Вуаль",sew:"Парный карниз, 2 шт",      done:false},
]
const QTOTAL = quoteItems.reduce((s,i)=>s+i.total,0)
const PAID = 500000

const ROLES = [
  {id:"admin",    label:"Администратор", color:"#0EA5E9",icon:<Settings size={13}/>},
  {id:"designer", label:"Дизайнер",      color:"#7C3AED",icon:<Edit3 size={13}/>},
  {id:"sewing",   label:"Швейный цех",   color:"#16A34A",icon:<Scissors size={13}/>},
  {id:"warehouse",label:"Менеджер склада",color:"#D97706",icon:<Package size={13}/>},
  {id:"installer",label:"Установщик",    color:"#3730A3",icon:<Truck size={13}/>},
]

/* ══ SHARED UI ══ */
const Btn = ({v="primary",sz,full,icon,children,onClick,style})=>(
  <button className={`btn btn-${v}${sz?" btn-"+sz:""}${full?" btn-full":""}${icon&&!children?" btn-icon":""}`} onClick={onClick} style={style}>
    {icon&&<span style={{display:"flex"}}>{icon}</span>}{children}
  </button>
)
const Badge = ({type,label})=><span className={`badge ${type}`}><span style={{width:5,height:5,borderRadius:"50%",background:"currentColor",opacity:.7,flexShrink:0}}/>{label}</span>
const Card = ({children,style,className=""})=><div className={`card ${className}`} style={style}>{children}</div>
const SLabel = ({c})=><div className="slbl">{c}</div>
const Prog = ({v,color="var(--a)"})=><div className="prog"><div className="prog-f" style={{width:`${v}%`,background:color}}/></div>
const Modal = ({open,onClose,title,children})=>!open?null:(
  <div className="modal-bg" onClick={onClose}>
    <div className="modal" onClick={e=>e.stopPropagation()}>
      <div style={{padding:"18px 20px 0",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{fontWeight:600,fontSize:15}}>{title}</div>
        <Btn v="ghost" sz="sm" icon={<X size={15}/>} onClick={onClose}/>
      </div>
      <div style={{padding:"14px 20px 20px"}}>{children}</div>
    </div>
  </div>
)
const StepTrack = ({steps})=>(
  <div style={{display:"flex",flexDirection:"column"}}>
    {steps.map((s,i)=>(
      <div key={i} style={{display:"flex",gap:10}}>
        <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
          <div className={`step-dot sd-${s.st}`}>{s.st==="done"?<CheckCheck size={12}/>:s.st==="act"?<RefreshCw size={12}/>:<Circle size={12}/>}</div>
          {i<steps.length-1&&<div style={{width:2,flex:1,minHeight:16,background:s.st==="done"?"var(--ok-bg)":"var(--border)",margin:"3px 0"}}/>}
        </div>
        <div style={{paddingBottom:i<steps.length-1?14:0,paddingTop:3}}>
          <div style={{fontWeight:500,fontSize:13,color:s.st==="act"?"var(--a)":s.st==="done"?"var(--ok)":"var(--t3)"}}>{s.l}</div>
          {s.sub&&<div style={{fontSize:11,color:"var(--t3)"}}>{s.sub}</div>}
        </div>
      </div>
    ))}
  </div>
)
const RoleBadge = ({role})=>{
  const r=ROLES.find(x=>x.id===role);if(!r)return null
  return <span style={{display:"inline-flex",alignItems:"center",gap:5,padding:"3px 10px",borderRadius:20,background:r.color+"18",color:r.color,fontSize:11,fontWeight:600}}>{r.icon}{r.label}</span>
}
const StatusDot = ({status})=>{
  const cls={problem:"std-err",warning:"std-warn",ok:"std-ok",gray:"std-gray"}[status]||"std-gray"
  return <div className={`st-dot ${cls}`}/>
}
const FInfo = ({label,value})=>(
  <div style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid var(--borderl)"}}>
    <span style={{fontSize:12,color:"var(--t2)"}}>{label}</span>
    <span style={{fontSize:13,fontWeight:500}}>{value||"—"}</span>
  </div>
)

/* ══════════════════════════════════════════
   01 — LOGIN
══════════════════════════════════════════ */
const S01_Login = ()=>(
  <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#F0F9FF,#E0F2FE,#F0F4F8)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
    <div style={{width:"100%",maxWidth:360}}>
      <div style={{textAlign:"center",marginBottom:28}}>
        <div style={{width:60,height:60,borderRadius:16,background:"var(--a)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px",boxShadow:"0 8px 24px rgba(14,165,233,.3)"}}><Scissors size={24} color="#fff"/></div>
        <div style={{fontSize:22,fontWeight:700}}>Единая база</div>
        <div style={{color:"var(--t2)",fontSize:13,marginTop:2}}>Название организации</div>
      </div>
      <Card>
        <div style={{padding:"22px 22px 18px"}}>
          <div className="ig"><label>E-mail / телефон</label><input className="input" placeholder="example@mail.com"/></div>
          <div className="ig"><label>Пароль</label><input className="input" type="password" placeholder="••••••••"/></div>
          <Btn v="primary" full icon={<LogIn size={15}/>}>Вход</Btn>
        </div>
      </Card>
      <div style={{textAlign:"center",marginTop:18,color:"var(--t3)",fontSize:12}}>SheberSolution</div>
    </div>
  </div>
)

/* ══════════════════════════════════════════
   02 — DASHBOARD
══════════════════════════════════════════ */
const S02_Dashboard = ()=>{
  const [tab,setTab]=useState("p")
  return(
    <div className="cwrap">
      <div style={{marginBottom:16}}>
        <div style={{fontSize:20,fontWeight:700}}>Название организации</div>
        <div style={{color:"var(--t2)",fontSize:12,marginTop:2}}>01.09.2025 — н.в. · <span style={{color:"var(--a)",cursor:"pointer"}}>Выбрать период</span></div>
      </div>
      <div className="dg3" style={{marginBottom:16}}>
        {[
          {l:"Все заказы",v:"843",c:"var(--t1)",icon:<ClipboardList size={16} color="var(--a)"/>},
          {l:"В работе",v:"97",c:"var(--a)",icon:<RefreshCw size={16} color="var(--a)"/>},
          {l:"Ожидают оплаты",v:"10",c:"var(--a)",icon:<CreditCard size={16} color="var(--a)"/>},
          {l:"Просрочено",v:"1",c:"var(--err)",icon:<AlertTriangle size={16} color="var(--err)"/>,w:"err"},
          {l:"Матер. на исходе",v:"8",c:"var(--warn)",icon:<Package size={16} color="var(--warn)"/>,w:"warn"},
        ].map((m,i)=>(
          <Card key={i} style={{padding:"13px 14px",display:"flex",alignItems:"center",gap:10,background:m.w==="err"?"#FFF5F5":m.w==="warn"?"#FFFBEB":"var(--card)"}}>
            <div style={{width:34,height:34,borderRadius:9,background:"var(--al)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{m.icon}</div>
            <div><div style={{fontSize:11,color:"var(--t3)",marginBottom:2}}>{m.l}</div><div style={{fontSize:20,fontWeight:700,color:m.c,lineHeight:1}}>{m.v}</div></div>
          </Card>
        ))}
      </div>
      <Card style={{padding:"14px 6px 10px"}}>
        <div style={{padding:"0 10px 10px",display:"flex",gap:6}}>
          {[["p","Прибыль"],["r","Выручка"],["e","Расходы"]].map(([id,l])=>(
            <button key={id} onClick={()=>setTab(id)} style={{padding:"5px 12px",borderRadius:20,border:"none",fontSize:12,fontWeight:500,background:tab===id?"var(--a)":"var(--bg)",color:tab===id?"#fff":"var(--t2)"}}>{l}</button>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <ComposedChart data={chartData} margin={{top:4,right:8,left:-20,bottom:0}}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false}/>
            <XAxis dataKey="m" tick={{fontSize:11,fill:"#94A3B8"}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fontSize:11,fill:"#94A3B8"}} axisLine={false} tickLine={false}/>
            <Tooltip contentStyle={{borderRadius:8,border:"1px solid var(--border)",fontSize:12}}/>
            <Bar dataKey={tab==="p"?"p":tab==="r"?"r":"p"} fill="var(--a)" radius={[4,4,0,0]} opacity={.85}/>
          </ComposedChart>
        </ResponsiveContainer>
      </Card>
    </div>
  )
}

/* ══════════════════════════════════════════
   03-07 — ORDERS LIST (role-aware)
══════════════════════════════════════════ */
const OrdersList = ({role,onOrderClick,onNew})=>{
  const [filter,setFilter]=useState("all")
  const [search,setSearch]=useState("")
  const roleView=["sewing","warehouse","installer"].includes(role)
  const getSt=o=>role==="sewing"?o.sewSt:role==="warehouse"?o.wrhSt:o.instSt
  const [tasks,setTasks]=useState({})
  const toggleTask=(oid,ti)=>setTasks(p=>({...p,[`${oid}-${ti}`]:!p[`${oid}-${ti}`]}))
  const warehouseTasks={1:["Закупить","Сделано","Нужно сделать"],2:["Закупить пуговицы"],5:["Закупить габардин 3м","Закупить фурнитуру"]}
  const warehouseChecked={1:[false,true,false],2:[false],5:[false,false]}

  const visible=ordersData.filter(o=>{
    if(role==="sewing") return["b-prod","b-inwork"].includes(o.status)
    if(role==="warehouse") return["b-new","b-inwork","b-prod"].includes(o.status)
    if(role==="installer") return["b-ready","b-install","b-payment"].includes(o.status)
    if(search&&!o.client.toLowerCase().includes(search.toLowerCase())) return false
    if(filter==="overdue") return o.overdue
    if(filter==="payment") return o.status==="b-payment"
    if(filter==="new") return o.status==="b-new"
    if(filter==="work") return o.status==="b-inwork"
    if(filter==="prod") return o.status==="b-prod"
    if(filter==="ready") return o.status==="b-ready"
    return true
  })

  return(
    <div className="cwrap">
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:8}}>
        <div>
          <div style={{fontSize:20,fontWeight:700}}>Управление заказами</div>
          <div style={{marginTop:3}}><RoleBadge role={role}/></div>
        </div>
        <div style={{display:"flex",gap:6}}>
          {!roleView&&<><Btn v="ghost" sz="sm" icon={<Search size={13}/>}/><Btn v="ghost" sz="sm" icon={<Filter size={13}/>}/></>}
          {["admin","designer"].includes(role)&&<Btn v="primary" sz="sm" icon={<Plus size={13}/>} onClick={onNew}>Новый</Btn>}
          {roleView&&<><Btn v="ghost" sz="sm" icon={<Search size={13}/>}/><Btn v="ghost" sz="sm" icon={<Filter size={13}/>}/></>}
          <Btn v="danger" sz="sm" icon={<LogOut size={13}/>}>Выйти</Btn>
        </div>
      </div>

      {!roleView&&(
        <div style={{marginBottom:12}}>
          <div style={{position:"relative",marginBottom:8}}>
            <Search size={13} style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:"var(--t3)"}}/>
            <input className="input" style={{paddingLeft:32}} placeholder="Поиск по клиенту..." value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
          <div style={{display:"flex",gap:6,overflow:"auto",paddingBottom:4}}>
            {[["all","Все"],["new","Новые"],["work","В работе"],["prod","Производство"],["ready","Готовые"],["overdue","Просрочены"],["payment","Ожидают оплату"]].map(([id,l])=>(
              <button key={id} className={`chip${filter===id?" act":""}`} onClick={()=>setFilter(id)}>{l}</button>
            ))}
          </div>
        </div>
      )}

      <Card style={{overflow:"hidden"}}>
        {visible.map(o=>(
          <div key={o.id} className="oli" onClick={()=>onOrderClick(o.id)}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                  <span style={{fontWeight:600,fontSize:14}}>№{o.id} [{o.client}]</span>
                  {o.overdue&&<span className="badge b-overdue" style={{fontSize:10}}><AlertTriangle size={9}/>Просрочен</span>}
                </div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  <span style={{fontSize:11,color:"var(--t3)"}}><Calendar size={9} style={{display:"inline",marginRight:2}}/>{o.date}</span>
                  <span style={{fontSize:11,color:"var(--t3)"}}><User size={9} style={{display:"inline",marginRight:2}}/>{o.designer}</span>
                </div>
                {role==="warehouse"&&warehouseTasks[o.id]&&(
                  <div style={{marginTop:8}} onClick={e=>e.stopPropagation()}>
                    {warehouseTasks[o.id].map((t,ti)=>{
                      const k=`${o.id}-${ti}`;const checked=tasks[k]!==undefined?tasks[k]:warehouseChecked[o.id]?.[ti]
                      return(
                        <div key={ti} style={{display:"flex",alignItems:"center",gap:7,padding:"4px 0",borderBottom:"1px solid var(--borderl)",cursor:"pointer"}} onClick={()=>toggleTask(o.id,ti)}>
                          {checked?<CheckSquare size={13} color="var(--ok)"/>:<Square size={13} color="var(--t3)"/>}
                          <span style={{fontSize:12,color:checked?"var(--t3)":"var(--t1)",textDecoration:checked?"line-through":"none"}}>{ti+1}. {t}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:5}}>
                {roleView?<StatusDot status={getSt(o)}/>:<><Badge type={o.status} label={o.sl}/><Badge type={o.mat} label={o.ml}/></>}
              </div>
            </div>
          </div>
        ))}
      </Card>
    </div>
  )
}

/* ══════════════════════════════════════════
   08 — DESIGNER MEASUREMENTS
══════════════════════════════════════════ */
const S08_DesignerMeasurements = ({onBack,onAdd,setScreen})=>{
  const [overlay,setOverlay]=useState(null)
  return(
    <div className="cwrap">
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <Btn v="ghost" sz="sm" icon={<ChevronRight size={15} style={{transform:"rotate(180deg)"}}/>} onClick={onBack}/>
          <div><div style={{fontSize:17,fontWeight:700}}>Заказ №1 (замеры)</div><RoleBadge role="designer"/></div>
        </div>
        <div style={{display:"flex",gap:6}}>
          <Btn v="ghost" sz="sm" icon={<Plus size={13}/>} onClick={onAdd}>Добавить</Btn>
          <Btn v="primary" sz="sm" icon={<FileText size={13}/>}>Создать КП</Btn>
        </div>
      </div>
      <Card style={{overflow:"hidden",marginBottom:12}}>
        {measurements.map((m,i)=>(
          <div key={m.id} className="oli" onClick={()=>setOverlay(m)}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
              <div>
                <div style={{fontWeight:600,fontSize:14}}>{m.room}</div>
                <div style={{fontSize:12,color:"var(--t2)"}}>{m.window} [{m.w}×{m.h}]</div>
                {m.fabric&&<div style={{fontSize:11,color:"var(--t3)",marginTop:2}}>Шторы: {m.fabric} ({m.fm}м){m.tulle?` · Тюль: ${m.tulle} (${m.tm}м)`:""}</div>}
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <span style={{fontSize:13,fontWeight:700}}>{m.price.toLocaleString()} ₸{m.qty?<span style={{fontSize:10,color:"var(--t3)",display:"block",textAlign:"right"}}>за {m.qty} шт.</span>:null}</span>
                <Btn v="ghost" sz="sm" icon={<Pencil size={12}/>} onClick={e=>{e.stopPropagation();setScreen("17_edit_measurement")}}/>
              </div>
            </div>
          </div>
        ))}
      </Card>
      {overlay&&(
        <div className="overlay-panel" onClick={()=>setOverlay(null)}>
          <div className="overlay-inner" onClick={e=>e.stopPropagation()}>
            <div style={{padding:"18px 20px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{fontWeight:600}}>{overlay.room} · {overlay.window}</div>
              <div style={{display:"flex",gap:6}}>
                <Btn v="ghost" sz="sm" icon={<Pencil size={13}/>}/>
                <Btn v="ghost" sz="sm" icon={<Trash2 size={13}/>} style={{color:"var(--err)"}}/>
                <Btn v="ghost" sz="sm" icon={<X size={15}/>} onClick={()=>setOverlay(null)}/>
              </div>
            </div>
            <div style={{padding:"16px 20px"}}>
              <FInfo label="Комната" value={overlay.room}/>
              <FInfo label="Окно / изделие" value={overlay.window}/>
              <FInfo label="Ширина × Высота" value={`${overlay.w} × ${overlay.h} см`}/>
              <FInfo label="Шторы" value={overlay.fabric?`${overlay.fabric} (${overlay.fm}м)`:"—"}/>
              <FInfo label="Тюль" value={overlay.tulle?`${overlay.tulle} (${overlay.tm}м)`:"—"}/>
              <FInfo label="Тип крепления" value={overlay.mount}/>
              {overlay.comment&&<div style={{marginTop:12,padding:"10px 14px",background:"var(--bg)",borderRadius:"var(--r)",fontSize:13,color:"var(--t2)"}}>💬 {overlay.comment}</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════
   09 — SEWING PRODUCTION ITEMS
══════════════════════════════════════════ */
const S09_SewingItems = ({onBack})=>{
  const [items,setItems]=useState(prodItems)
  const [notes,setNotes]=useState(false)
  const toggle=id=>setItems(p=>p.map(i=>i.id===id?{...i,done:!i.done}:i))
  return(
    <div className="cwrap">
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <Btn v="ghost" sz="sm" icon={<ChevronRight size={15} style={{transform:"rotate(180deg)"}}/>} onClick={onBack}/>
          <div><div style={{fontSize:17,fontWeight:700}}>Заказ №1</div><RoleBadge role="sewing"/></div>
        </div>
        <Btn v="ghost" sz="sm" icon={<Filter size={13}/>}/>
      </div>
      <Card style={{overflow:"hidden",marginBottom:12}}>
        {items.map((it,i)=>(
          <div key={it.id} style={{padding:"13px 16px",borderBottom:i<items.length-1?"1px solid var(--borderl)":"none",display:"flex",alignItems:"center",gap:12}}>
            <div style={{cursor:"pointer",flexShrink:0}} onClick={()=>toggle(it.id)}>
              <div style={{width:22,height:22,borderRadius:6,background:it.done?"var(--ok-bg)":"var(--bg)",border:it.done?"2px solid var(--ok)":"2px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                {it.done&&<CheckCheck size={12} color="var(--ok)"/>}
              </div>
            </div>
            <div style={{flex:1}}>
              <div style={{fontWeight:600,fontSize:14,color:it.done?"var(--t3)":"var(--t1)",textDecoration:it.done?"line-through":"none"}}>{it.room}</div>
              <div style={{fontSize:12,color:"var(--t2)"}}>{it.window}</div>
              <div style={{fontSize:11,color:"var(--t3)",marginTop:1}}>{it.fabric}{it.tulle?` · ${it.tulle}`:""}</div>
              <div style={{fontSize:11,color:"var(--t3)"}}>{it.sew}</div>
            </div>
            {it.done&&<Badge type="b-done" label="Готово"/>}
          </div>
        ))}
      </Card>
      <Btn v="secondary" full icon={<StickyNote size={13}/>} onClick={()=>setNotes(true)}>Примечания к заказу</Btn>
      {notes&&(
        <div className="overlay-panel" onClick={()=>setNotes(false)}>
          <div className="overlay-inner" onClick={e=>e.stopPropagation()}>
            <div style={{padding:"18px 20px",borderBottom:"1px solid var(--border)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontWeight:600}}>Примечания</div>
              <Btn v="ghost" sz="sm" icon={<X size={15}/>} onClick={()=>setNotes(false)}/>
            </div>
            <div style={{padding:20}}>
              <div style={{fontSize:13,color:"var(--t2)",lineHeight:1.7,marginBottom:12}}>Сделать то-то, сделать так-то.</div>
              <div className="divider" style={{margin:"12px 0"}}/>
              <textarea className="textarea" placeholder="Добавить примечание..." style={{width:"100%"}}/>
              <Btn v="primary" full style={{marginTop:10}}>Сохранить</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════
   10 — INSTALLER ITEMS
══════════════════════════════════════════ */
const S10_InstallerItems = ({onBack})=>(
  <div className="cwrap">
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:8}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <Btn v="ghost" sz="sm" icon={<ChevronRight size={15} style={{transform:"rotate(180deg)"}}/>} onClick={onBack}/>
        <div><div style={{fontSize:17,fontWeight:700}}>Заказ №1</div><RoleBadge role="installer"/></div>
      </div>
      <Btn v="ghost" sz="sm" icon={<Filter size={13}/>}/>
    </div>
    <Card style={{overflow:"hidden",marginBottom:12}}>
      {prodItems.map((it,i)=>(
        <div key={it.id} style={{padding:"13px 16px",borderBottom:i<prodItems.length-1?"1px solid var(--borderl)":"none",display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:22,height:22,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",background:it.done?"var(--ok-bg)":"var(--bg)",border:it.done?"2px solid var(--ok)":"2px solid var(--border)",flexShrink:0}}>
            {it.done&&<CheckCheck size={12} color="var(--ok)"/>}
          </div>
          <div style={{flex:1}}>
            <div style={{fontWeight:600,fontSize:14}}>{it.room}</div>
            <div style={{fontSize:12,color:"var(--t2)"}}>{it.window}</div>
          </div>
        </div>
      ))}
    </Card>
    <Card style={{padding:"12px 16px",background:"var(--warn-bg)",border:"1px solid var(--warn-b)",marginBottom:12}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <AlertTriangle size={15} color="var(--warn)"/>
        <div><div style={{fontWeight:600,fontSize:13,color:"var(--warn)"}}>Требуется финальная оплата</div><div style={{fontSize:11,color:"var(--t2)"}}>Уточните у менеджера перед выдачей</div></div>
      </div>
    </Card>
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      <Btn v="primary" full icon={<Camera size={13}/>}>Загрузить фотоотчёт</Btn>
      <Btn v="secondary" full icon={<FileSignature size={13}/>}>Загрузить АВР</Btn>
      <Btn v="success" full icon={<CheckCheck size={13}/>}>Установка выполнена</Btn>
    </div>
  </div>
)

/* ══════════════════════════════════════════
   11 — ADMIN ORDER DETAIL
══════════════════════════════════════════ */
const S11_AdminOrderDetail = ({orderId=1,onBack})=>{
  const [tab,setTab]=useState("main")
  const [modal,setModal]=useState(false)
  const [finPanel,setFinPanel]=useState(false)
  const order=ordersData.find(o=>o.id===orderId)||ordersData[0]
  const tabs=[{id:"main",l:"Обзор"},{id:"measurements",l:"Замеры"},{id:"quote",l:"КП"},{id:"production",l:"Производство"},{id:"finance",l:"Финансы"},{id:"photo",l:"Фото"},{id:"docs",l:"АВР/Документы"}]
  const orderSteps=[
    {l:"Замер и КП",sub:"28.03.26",st:"done"},{l:"Материалы",sub:"Частично готовы",st:"act"},
    {l:"Производство",sub:"В пошиве",st:"act"},{l:"Установка / выдача",sub:"Ожидает",st:"pend"},
    {l:"Фото и АВР",sub:"Ожидает",st:"pend"},{l:"Финальная оплата",sub:"Ожидает",st:"pend"},
    {l:"Завершение",sub:"Ожидает",st:"pend"},
  ]
  return(
    <div className="cwrap">
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <Btn v="ghost" sz="sm" icon={<ChevronRight size={15} style={{transform:"rotate(180deg)"}}/>} onClick={onBack}/>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <div style={{fontSize:17,fontWeight:700}}>Заказ №{orderId} · {order.client}</div>
              <Badge type={order.status} label={order.sl}/>
            </div>
            <div style={{display:"flex",gap:8,marginTop:3,flexWrap:"wrap"}}>
              <span style={{fontSize:11,color:"var(--t3)"}}><Calendar size={9} style={{display:"inline",marginRight:2}}/>01.05.26</span>
              <span style={{fontSize:11,color:"var(--t3)"}}><User size={9} style={{display:"inline",marginRight:2}}/>{order.designer}</span>
              <RoleBadge role="admin"/>
            </div>
          </div>
        </div>
        <div style={{display:"flex",gap:6}}>
          <Btn v="ghost" sz="sm" icon={<Pencil size={13}/>}/>
          <Btn v="primary" sz="sm" icon={<ArrowRight size={13}/>}>Следующий шаг</Btn>
        </div>
      </div>
      <div className="top-nav" style={{borderRadius:"var(--rl)",overflow:"hidden",marginBottom:14}}>
        <div style={{display:"flex",overflow:"auto",padding:"0 6px"}}>
          {tabs.map(t=><button key={t.id} className={`nav-tab${tab===t.id?" active":""}`} onClick={()=>setTab(t.id)}>{t.l}</button>)}
        </div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {tab==="main"&&<>
          <div className="dg3">
            {[{l:"Сумма",v:`${(QTOTAL/1000).toFixed(0)}к ₸`,c:"var(--t1)"},{l:"Оплачено",v:`${(PAID/1000).toFixed(0)}к ₸`,c:"var(--ok)"},{l:"Остаток",v:`${((QTOTAL-PAID)/1000).toFixed(0)}к ₸`,c:"var(--warn)"}].map((k,i)=>(
              <Card key={i} style={{padding:"12px 14px"}}><div style={{fontSize:11,color:"var(--t3)",marginBottom:4}}>{k.l}</div><div style={{fontWeight:700,fontSize:16,color:k.c}}>{k.v}</div></Card>
            ))}
          </div>
          <Card style={{padding:"13px 15px",background:"var(--al)",border:"1px solid var(--am)"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
              <div>
                <div style={{fontSize:10,color:"var(--a)",fontWeight:700,textTransform:"uppercase",letterSpacing:".07em",marginBottom:4}}>Следующее действие</div>
                <div style={{fontWeight:500,fontSize:13}}>Завершить пошив и передать на ОТК</div>
                <div style={{fontSize:11,color:"var(--t3)",marginTop:2}}>Производство · Срок: 20.04.26</div>
              </div>
              <Btn v="primary" sz="sm" icon={<CheckCircle2 size={13}/>} onClick={()=>setModal(true)}>Готово</Btn>
            </div>
          </Card>
          <div>
            <SLabel c="Блокеры"/>
            <div className="blocker"><AlertTriangle size={14} style={{flexShrink:0,marginTop:1}}/><div><div style={{fontWeight:500}}>Материалы не готовы</div><div style={{fontSize:11,opacity:.8}}>Габардин синий 2м — склад «Аян»</div></div></div>
          </div>
          <Card style={{padding:"13px 15px"}}><SLabel c="Прогресс заказа"/><StepTrack steps={orderSteps}/></Card>
        </>}
        {tab==="measurements"&&(
          <Card style={{overflow:"hidden"}}>
            {measurements.map((m,i)=>(
              <div key={m.id} style={{padding:"13px 16px",borderBottom:i<measurements.length-1?"1px solid var(--borderl)":"none"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontWeight:600}}>{m.room} · {m.window}</div>
                    <div style={{fontSize:12,color:"var(--t2)",marginTop:2}}>📐 {m.w}×{m.h}см · 🪡 {m.fabric} {m.fm}м{m.tulle?` · 🎀 ${m.tulle} ${m.tm}м`:""} · 🔩 {m.mount}</div>
                    {m.comment&&<div style={{fontSize:11,color:"var(--t3)",marginTop:3}}>💬 {m.comment}</div>}
                  </div>
                  <div style={{display:"flex",gap:4}}>
                    <Btn v="ghost" sz="sm" icon={<Pencil size={12}/>}/>
                    <Btn v="ghost" sz="sm" icon={<Trash2 size={12}/>} style={{color:"var(--err)"}}/>
                  </div>
                </div>
              </div>
            ))}
          </Card>
        )}
        {tab==="quote"&&(
          <Card style={{overflow:"hidden"}}>
            <div style={{overflowX:"auto"}}>
              <table className="tbl">
                <thead><tr><th>Комната / Окно</th><th>Ткань</th><th>Тюль</th><th>Пошив</th><th>Карниз</th><th style={{textAlign:"right"}}>Итого</th></tr></thead>
                <tbody>
                  {quoteItems.map(qi=>(
                    <tr key={qi.id}>
                      <td><div style={{fontWeight:500,fontSize:13}}>{qi.room}</div><div style={{fontSize:11,color:"var(--t3)"}}>{qi.window}</div></td>
                      <td>{qi.fabric?<><div style={{fontSize:12}}>{qi.fabric}</div><div style={{fontSize:11,color:"var(--t3)"}}>{qi.fc.toLocaleString()} ₸</div></>:"—"}</td>
                      <td>{qi.tulle?<><div style={{fontSize:12}}>{qi.tulle}</div><div style={{fontSize:11,color:"var(--t3)"}}>{qi.tc.toLocaleString()} ₸</div></>:"—"}</td>
                      <td style={{fontSize:12}}>{qi.sewing.toLocaleString()} ₸</td>
                      <td style={{fontSize:12}}>{qi.cornice.toLocaleString()} ₸</td>
                      <td style={{textAlign:"right",fontWeight:700}}>{qi.total.toLocaleString()} ₸{qi.qty&&<div style={{fontSize:10,color:"var(--t3)"}}>за {qi.qty} шт.</div>}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr><td colSpan={5} style={{fontWeight:600,textAlign:"right",paddingTop:12,borderTop:"1px solid var(--border)"}}>Итого</td><td style={{textAlign:"right",fontWeight:700,fontSize:15,paddingTop:12,borderTop:"1px solid var(--border)",color:"var(--a)"}}>{QTOTAL.toLocaleString()} ₸</td></tr></tfoot>
              </table>
            </div>
          </Card>
        )}
        {tab==="production"&&(
          <Card style={{overflow:"hidden"}}>
            {prodItems.map((it,i)=>(
              <div key={it.id} style={{padding:"13px 16px",borderBottom:i<prodItems.length-1?"1px solid var(--borderl)":"none",display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:22,height:22,borderRadius:6,background:it.done?"var(--ok-bg)":"var(--bg)",border:it.done?"2px solid var(--ok)":"2px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  {it.done&&<CheckCheck size={12} color="var(--ok)"/>}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:500}}>{it.room} · {it.window}</div>
                  <div style={{fontSize:11,color:"var(--t3)"}}>{it.fabric}{it.tulle?` · ${it.tulle}`:""} · {it.sew}</div>
                </div>
                <Badge type={it.done?"b-done":"b-prod"} label={it.done?"Готово":"В пошиве"}/>
              </div>
            ))}
          </Card>
        )}
        {tab==="finance"&&<>
          <Card style={{padding:15,cursor:"pointer"}} onClick={()=>setFinPanel(true)}>
            <SLabel c="Финансы"/>
            <FInfo label="Итоговая стоимость" value={`${QTOTAL.toLocaleString()} ₸`}/>
            <FInfo label="Предоплата" value={`${PAID.toLocaleString()} ₸`}/>
            <FInfo label="Остаток" value={`${(QTOTAL-PAID).toLocaleString()} ₸`}/>
            <div style={{marginTop:12}}><Prog v={PAID/QTOTAL*100} color="var(--ok)"/><div style={{display:"flex",justifyContent:"space-between",marginTop:4,fontSize:11,color:"var(--t3)"}}><span>Оплачено: {Math.round(PAID/QTOTAL*100)}%</span><span>Нажмите для деталей →</span></div></div>
          </Card>
          <div className="dg2">
            <Btn v="primary" full icon={<CreditCard size={13}/>}>Зафиксировать платёж</Btn>
            <Btn v="secondary" full icon={<Banknote size={13}/>}>Выставить счёт</Btn>
          </div>
        </>}
        {tab==="photo"&&(
          <Card style={{padding:15}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}><SLabel c="Фотоотчёт"/><Btn v="primary" sz="sm" icon={<Camera size={13}/>}>Загрузить</Btn></div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
              {["замер_1","замер_2","ткань"].map((p,i)=>(
                <div key={i} style={{aspectRatio:"1",borderRadius:8,background:"linear-gradient(135deg,#E0F2FE,#BAE6FD)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,border:"1px solid var(--border)"}}>
                  <Image size={17} color="var(--a)"/><div style={{fontSize:9,color:"var(--a)",textAlign:"center"}}>{p}.jpg</div>
                </div>
              ))}
              <div style={{aspectRatio:"1",borderRadius:8,border:"2px dashed var(--border)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,cursor:"pointer"}}>
                <Plus size={17} color="var(--t3)"/><div style={{fontSize:10,color:"var(--t3)"}}>Добавить</div>
              </div>
            </div>
          </Card>
        )}
        {tab==="docs"&&<>
          <Card style={{overflow:"hidden"}}>
            {[{n:"КП №1",d:"28.03.26",t:"КП",s:"b-done",sl:"Принят"},{n:"АВР №1",d:"—",t:"АВР",s:"b-new",sl:"Не создан"}].map((doc,i)=>(
              <div key={i} style={{padding:"13px 15px",borderBottom:i===0?"1px solid var(--borderl)":"none",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:34,height:34,borderRadius:8,background:"var(--al)",display:"flex",alignItems:"center",justifyContent:"center"}}><FileSignature size={15} color="var(--a)"/></div>
                  <div><div style={{fontWeight:500,fontSize:13}}>{doc.n}</div><div style={{fontSize:11,color:"var(--t3)"}}>{doc.d} · {doc.t}</div></div>
                </div>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <Badge type={doc.s} label={doc.sl}/>
                  {doc.s==="b-done"?<Btn v="ghost" sz="sm" icon={<Eye size={13}/>}/>:<Btn v="primary" sz="sm" icon={<FilePlus size={12}/>}>Создать</Btn>}
                </div>
              </div>
            ))}
          </Card>
          <Btn v="secondary" full icon={<Upload size={13}/>}>Загрузить документ</Btn>
        </>}
      </div>
      {/* Finance overlay */}
      {finPanel&&(
        <div className="overlay-panel" onClick={()=>setFinPanel(false)}>
          <div className="overlay-inner" onClick={e=>e.stopPropagation()}>
            <div style={{padding:"18px 20px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{fontWeight:600}}>Финансы overlay</div>
              <div style={{display:"flex",gap:6}}><Btn v="ghost" sz="sm" icon={<Pencil size={13}/>}/><Btn v="ghost" sz="sm" icon={<Trash2 size={13}/>} style={{color:"var(--err)"}}/><Btn v="ghost" sz="sm" icon={<X size={15}/>} onClick={()=>setFinPanel(false)}/></div>
            </div>
            <div style={{padding:20}}>
              <FInfo label="Итоговая стоимость" value={`1 000 000 ₸`}/>
              <FInfo label="Предоплата" value={`500 000 ₸`}/>
              <FInfo label="Дата / Метод" value="01.04.26 · Наличные"/>
              <div style={{marginTop:14}}><Prog v={50} color="var(--ok)"/><div style={{display:"flex",justifyContent:"space-between",marginTop:5,fontSize:11,color:"var(--t3)"}}><span>Оплачено: 50%</span><span>Остаток: 500 000 ₸</span></div></div>
            </div>
          </div>
        </div>
      )}
      <Modal open={modal} onClose={()=>setModal(false)} title="Подтвердить выполнение">
        <div style={{color:"var(--t2)",fontSize:13,marginBottom:14}}>Завершить пошив и передать на ОТК?</div>
        <div className="ig"><label>Комментарий</label><input className="input" placeholder="Всё готово"/></div>
        <div style={{display:"flex",gap:8}}><Btn v="secondary" full onClick={()=>setModal(false)}>Отмена</Btn><Btn v="primary" full icon={<CheckCheck size={13}/>} onClick={()=>setModal(false)}>Подтвердить</Btn></div>
      </Modal>
    </div>
  )
}

/* ══════════════════════════════════════════
   15 — CREATE ORDER
══════════════════════════════════════════ */
const S15_CreateOrder = ({mode="create",onBack})=>{
  const [f,setF]=useState({client:"",designer:"",dm:"",dd:"",city:"",street:"",house:"",apt:"",note:""})
  const up=(k,v)=>setF(p=>({...p,[k]:v}))
  return(
    <div className="cwrap">
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
        <Btn v="ghost" sz="sm" icon={<ChevronRight size={15} style={{transform:"rotate(180deg)"}}/>} onClick={onBack}/>
        <div style={{fontSize:20,fontWeight:700}}>{mode==="create"?"Создание заказа":"Редактирование"}</div>
      </div>
      <Card style={{padding:18}}>
        <div style={{fontSize:11,fontWeight:700,color:"var(--t3)",textTransform:"uppercase",letterSpacing:".07em",marginBottom:6}}>1. Клиент <span style={{color:"var(--err)"}}>*</span></div>
        <div className="ig">
          <div style={{position:"relative"}}><Search size={13} style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",color:"var(--t3)"}}/><input className="input" style={{paddingLeft:32}} placeholder="E-mail/телефон" value={f.client} onChange={e=>up("client",e.target.value)}/></div>
        </div>
        <div style={{fontSize:11,fontWeight:700,color:"var(--t3)",textTransform:"uppercase",letterSpacing:".07em",marginBottom:6}}>2. Дизайнер</div>
        <div className="ig">
          <select className="input select" value={f.designer} onChange={e=>up("designer",e.target.value)}>
            <option value="">Выберите дизайнера</option><option>Ибраева</option><option>Калиева</option><option>Мусаева</option>
          </select>
        </div>
        <div className="ig2" style={{marginBottom:12}}>
          <div><div style={{fontSize:11,fontWeight:700,color:"var(--t3)",textTransform:"uppercase",letterSpacing:".07em",marginBottom:6}}>3. Дата замера</div><div style={{position:"relative"}}><Calendar size={12} style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"var(--t3)"}}/><input className="input" style={{paddingLeft:28}} placeholder="ДД.ММ.ГГГГ" value={f.dm} onChange={e=>up("dm",e.target.value)}/></div></div>
          <div><div style={{fontSize:11,fontWeight:700,color:"var(--t3)",textTransform:"uppercase",letterSpacing:".07em",marginBottom:6}}>4. Завершение</div><div style={{position:"relative"}}><Calendar size={12} style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"var(--t3)"}}/><input className="input" style={{paddingLeft:28}} placeholder="ДД.ММ.ГГГГ" value={f.dd} onChange={e=>up("dd",e.target.value)}/></div></div>
        </div>
        <div style={{fontSize:11,fontWeight:700,color:"var(--t3)",textTransform:"uppercase",letterSpacing:".07em",marginBottom:6}}>5. Адрес установки</div>
        <div className="ig2" style={{marginBottom:8}}>
          <div style={{position:"relative"}}><MapPin size={12} style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"var(--t3)"}}/><input className="input" style={{paddingLeft:28}} placeholder="Город" value={f.city} onChange={e=>up("city",e.target.value)}/></div>
          <input className="input" placeholder="Улица" value={f.street} onChange={e=>up("street",e.target.value)}/>
        </div>
        <div className="ig2" style={{marginBottom:8}}>
          <input className="input" placeholder="Дом" value={f.house} onChange={e=>up("house",e.target.value)}/>
          <input className="input" placeholder="Квартира" value={f.apt} onChange={e=>up("apt",e.target.value)}/>
        </div>
        <div className="ig" style={{marginBottom:16}}>
          <div style={{position:"relative"}}><StickyNote size={12} style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"var(--t3)"}}/><input className="input" style={{paddingLeft:28}} placeholder="Примечание" value={f.note} onChange={e=>up("note",e.target.value)}/></div>
        </div>
        <Btn v="primary" full icon={mode==="create"?<Plus size={14}/>:<CheckCheck size={14}/>}>{mode==="create"?"Создать":"Сохранить"}</Btn>
      </Card>
    </div>
  )
}

/* ══════════════════════════════════════════
   17 — CREATE MEASUREMENT
══════════════════════════════════════════ */
const S17_CreateMeasurement = ({mode="create",onBack})=>{
  const [f,setF]=useState({room:"",win:"",w:"",h:"",fabric:"",fm:"",tulle:"",tm:"",mount:"",comment:""})
  const up=(k,v)=>setF(p=>({...p,[k]:v}))
  const fabrics=["Блэкаут","Шёлк","Лён","Велюр","Жаккард","Органза","Вуаль","Тюль белый"]
  const mounts=["Потолочный","Настенный","Встроенный","Электрокарниз","Без карниза"]
  return(
    <div className="cwrap">
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
        <Btn v="ghost" sz="sm" icon={<ChevronRight size={15} style={{transform:"rotate(180deg)"}}/>} onClick={onBack}/>
        <div style={{fontSize:20,fontWeight:700}}>{mode==="create"?"Создание замера":"Редактирование"}</div>
      </div>
      <Card style={{padding:18}}>
        <div style={{fontSize:11,fontWeight:700,color:"var(--t3)",textTransform:"uppercase",marginBottom:6}}>1. Комната <span style={{color:"var(--err)"}}>*</span></div>
        <div className="ig"><input className="input" placeholder="Например: Гостиная" value={f.room} onChange={e=>up("room",e.target.value)}/></div>
        <div style={{fontSize:11,fontWeight:700,color:"var(--t3)",textTransform:"uppercase",marginBottom:6}}>2. Окно/изделие <span style={{color:"var(--err)"}}>*</span></div>
        <div className="ig"><input className="input" placeholder="Например: Окно 1" value={f.win} onChange={e=>up("win",e.target.value)}/></div>
        <div className="ig2" style={{marginBottom:12}}>
          <div><div style={{fontSize:11,fontWeight:700,color:"var(--t3)",textTransform:"uppercase",marginBottom:6}}>3. Ширина (см) <span style={{color:"var(--err)"}}>*</span></div><input className="input" type="number" placeholder="напр. 200" value={f.w} onChange={e=>up("w",e.target.value)}/></div>
          <div><div style={{fontSize:11,fontWeight:700,color:"var(--t3)",textTransform:"uppercase",marginBottom:6}}>4. Высота (см) <span style={{color:"var(--err)"}}>*</span></div><input className="input" type="number" placeholder="напр. 280" value={f.h} onChange={e=>up("h",e.target.value)}/></div>
        </div>
        <div style={{fontSize:11,fontWeight:700,color:"var(--t3)",textTransform:"uppercase",marginBottom:6}}>5. Ткань штор</div>
        <div style={{display:"flex",gap:8,marginBottom:12,alignItems:"center"}}>
          <select className="input select" style={{flex:1}} value={f.fabric} onChange={e=>up("fabric",e.target.value)}>
            <option value="">Выберите ткань</option>{fabrics.map(x=><option key={x}>{x}</option>)}
          </select>
          <input className="input" style={{width:64}} type="number" placeholder="м" value={f.fm} onChange={e=>up("fm",e.target.value)}/>
          <span style={{fontSize:12,color:"var(--t3)",whiteSpace:"nowrap"}}>метры</span>
        </div>
        <div style={{fontSize:11,fontWeight:700,color:"var(--t3)",textTransform:"uppercase",marginBottom:6}}>6. Ткань тюля</div>
        <div style={{display:"flex",gap:8,marginBottom:12,alignItems:"center"}}>
          <select className="input select" style={{flex:1}} value={f.tulle} onChange={e=>up("tulle",e.target.value)}>
            <option value="">Выберите тюль</option>{fabrics.map(x=><option key={x}>{x}</option>)}
          </select>
          <input className="input" style={{width:64}} type="number" placeholder="м" value={f.tm} onChange={e=>up("tm",e.target.value)}/>
          <span style={{fontSize:12,color:"var(--t3)",whiteSpace:"nowrap"}}>метры</span>
        </div>
        <div style={{fontSize:11,fontWeight:700,color:"var(--t3)",textTransform:"uppercase",marginBottom:6}}>7. Тип крепления</div>
        <div className="ig">
          <select className="input select" value={f.mount} onChange={e=>up("mount",e.target.value)}>
            <option value="">Выберите крепление</option>{mounts.map(x=><option key={x}>{x}</option>)}
          </select>
        </div>
        <div style={{fontSize:11,fontWeight:700,color:"var(--t3)",textTransform:"uppercase",marginBottom:6}}>8. Комментарии по изделию</div>
        <div className="ig" style={{marginBottom:16}}><textarea className="textarea" placeholder="Примечание" value={f.comment} onChange={e=>up("comment",e.target.value)}/></div>
        <Btn v="primary" full icon={mode==="create"?<Plus size={14}/>:<CheckCheck size={14}/>}>{mode==="create"?"Создать":"Сохранить"}</Btn>
      </Card>
    </div>
  )
}

/* ══════════════════════════════════════════
   SCREEN MAP (главная карта)
══════════════════════════════════════════ */
const screenList = [
  {id:"01_login",          num:"01", label:"Авторизация",                  route:"/login",             role:"all",      roleColor:"#64748B", icon:<LogIn size={14}/>},
  {id:"02_dashboard",      num:"02", label:"Дашборд",                       route:"/dashboard",         role:"admin",    roleColor:"#0EA5E9", icon:<LayoutDashboard size={14}/>},
  {id:"03_orders_admin",   num:"03", label:"Заказы (Администратор)",        route:"/orders",            role:"admin",    roleColor:"#0EA5E9", icon:<ClipboardList size={14}/>},
  {id:"04_orders_designer",num:"04", label:"Заказы (Дизайнер)",             route:"/orders",            role:"designer", roleColor:"#7C3AED", icon:<ClipboardList size={14}/>},
  {id:"05_orders_sewing",  num:"05", label:"Заказы (Швейный цех)",          route:"/orders",            role:"sewing",   roleColor:"#16A34A", icon:<Scissors size={14}/>},
  {id:"06_orders_warehouse",num:"06",label:"Заказы (Склад)",                route:"/orders",            role:"warehouse",roleColor:"#D97706", icon:<Package size={14}/>},
  {id:"07_orders_installer",num:"07",label:"Заказы (Установщик)",           route:"/orders",            role:"installer",roleColor:"#3730A3", icon:<Truck size={14}/>},
  {id:"08_designer_detail",num:"08", label:"Заказ — Замеры (Дизайнер)",     route:"/orders/:id",        role:"designer", roleColor:"#7C3AED", icon:<Ruler size={14}/>},
  {id:"09_sewing_detail",  num:"09", label:"Заказ — Изделия (Цех)",         route:"/orders/:id",        role:"sewing",   roleColor:"#16A34A", icon:<Scissors size={14}/>},
  {id:"10_installer_detail",num:"10",label:"Заказ — Изделия (Установщик)",  route:"/orders/:id",        role:"installer",roleColor:"#3730A3", icon:<Truck size={14}/>},
  {id:"11_admin_detail",   num:"11", label:"Заказ — Полный (Администратор)",route:"/orders/:id",        role:"admin",    roleColor:"#0EA5E9", icon:<FileText size={14}/>},
  {id:"15_create_order",   num:"15", label:"Создание заказа",               route:"/orders/new",        role:"admin",    roleColor:"#0EA5E9", icon:<Plus size={14}/>},
  {id:"16_edit_order",     num:"16", label:"Редактирование заказа",         route:"/orders/:id/edit",   role:"admin",    roleColor:"#0EA5E9", icon:<Edit3 size={14}/>},
  {id:"17_create_meas",    num:"17", label:"Создание замера",               route:"/measurements/new",  role:"designer", roleColor:"#7C3AED", icon:<Ruler size={14}/>},
  {id:"18_edit_meas",      num:"18", label:"Редактирование замера",         route:"/measurements/:id",  role:"designer", roleColor:"#7C3AED", icon:<Pencil size={14}/>},
]

const ScreenMap = ({onSelect})=>(
  <div className="screen-map">
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
      <div>
        <div style={{fontSize:22,fontWeight:700}}>Sheber ERP — Карта экранов</div>
        <div style={{color:"var(--t2)",fontSize:13,marginTop:2}}>{screenList.length} экранов · 5 ролей · Web + Mobile</div>
      </div>
      <div style={{display:"flex",gap:8}}>
        {ROLES.map(r=><RoleBadge key={r.id} role={r.id}/>)}
      </div>
    </div>

    <div className="sm-grid">
      {screenList.map(s=>(
        <div key={s.id} className="sm-card" onClick={()=>onSelect(s.id)}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:32,height:32,borderRadius:8,background:s.roleColor+"18",display:"flex",alignItems:"center",justifyContent:"center",color:s.roleColor,flexShrink:0}}>{s.icon}</div>
            <div className="sm-num">Экран {s.num}</div>
          </div>
          <div style={{fontWeight:600,fontSize:13,lineHeight:1.4}}>{s.label}</div>
          <div className="sm-route">{s.route}</div>
          <div>
            <span className="sm-role" style={{background:s.roleColor+"18",color:s.roleColor}}>{s.role==="all"?"все роли":s.role}</span>
          </div>
        </div>
      ))}
    </div>
  </div>
)

/* ══════════════════════════════════════════
   APP SHELL
══════════════════════════════════════════ */
const Sidebar = ({screen,setScreen,role,setRole,open,close})=>{
  const rc=ROLES.find(r=>r.id===role)?.color||"var(--a)"
  const nav=[
    {id:"map",      icon:<Grid size={14}/>,         l:"Карта экранов"},
    {id:"02_dashboard",icon:<LayoutDashboard size={14}/>,l:"Дашборд",roles:["admin"]},
    {id:"orders",   icon:<ClipboardList size={14}/>, l:"Заказы"},
    {id:"new_order",icon:<Plus size={14}/>,          l:"Новый заказ",roles:["admin","designer"]},
    {id:"new_meas", icon:<Ruler size={14}/>,         l:"Новый замер",roles:["admin","designer"]},
  ].filter(n=>!n.roles||n.roles.includes(role))
  return(
    <div className={`sidebar${open?" open":""}`}>
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon"><Scissors size={14} color="#fff"/></div>
        <div><div style={{fontSize:13,fontWeight:700}}>Sheber ERP</div><div style={{fontSize:11,color:"var(--t3)"}}>Прототип</div></div>
      </div>
      <div style={{padding:"8px 12px",borderBottom:"1px solid var(--border)"}}>
        <div style={{fontSize:10,fontWeight:700,color:"var(--t3)",textTransform:"uppercase",marginBottom:5}}>Роль</div>
        <select className="input select" style={{fontSize:12,padding:"6px 28px 6px 10px",background:rc+"10",borderColor:rc+"40",color:rc,fontWeight:600}} value={role} onChange={e=>{setRole(e.target.value);close()}}>
          {ROLES.map(r=><option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
      </div>
      <nav className="sidebar-nav">
        <div style={{fontSize:10,fontWeight:700,color:"var(--t3)",textTransform:"uppercase",letterSpacing:".1em",padding:"10px 12px 4px"}}>Навигация</div>
        {nav.map(n=>(
          <button key={n.id} className={`sidebar-item${screen===n.id?" active":""}`} onClick={()=>{setScreen(n.id);close()}}>
            <span style={{color:screen===n.id?"var(--a)":"var(--t3)",display:"flex"}}>{n.icon}</span>{n.l}
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderRadius:"var(--r)",background:"var(--bg)"}}>
          <div style={{width:28,height:28,borderRadius:"50%",background:"var(--al)",display:"flex",alignItems:"center",justifyContent:"center"}}><User size={13} color="var(--a)"/></div>
          <div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:600}}>Ибраева А.</div><div style={{fontSize:10,color:"var(--t3)"}}>{ROLES.find(r=>r.id===role)?.label}</div></div>
          <Btn v="ghost" icon={<LogOut size={12}/>} style={{color:"var(--err)",padding:5}}/>
        </div>
      </div>
    </div>
  )
}

export default function App(){
  const [screen,setScreen]=useState("map")
  const [role,setRole]=useState("admin")
  const [selectedOrder,setSelectedOrder]=useState(1)
  const [sidebarOpen,setSidebarOpen]=useState(false)
  const close=()=>setSidebarOpen(false)

  const goOrder=id=>{setSelectedOrder(id);setScreen("order_detail")}

  const getOrderDetailScreen=()=>{
    if(role==="designer") return <S08_DesignerMeasurements onBack={()=>setScreen("orders")} onAdd={()=>setScreen("new_meas")} setScreen={setScreen}/>
    if(role==="sewing")   return <S09_SewingItems onBack={()=>setScreen("orders")}/>
    if(role==="installer")return <S10_InstallerItems onBack={()=>setScreen("orders")}/>
    return <S11_AdminOrderDetail orderId={selectedOrder} onBack={()=>setScreen("orders")}/>
  }

  const renderScreen=()=>{
    if(screen==="map") return null
    switch(screen){
      case "01_login":          return <S01_Login/>
      case "02_dashboard":      return <S02_Dashboard/>
      case "03_orders_admin":   return <OrdersList role="admin"     onOrderClick={goOrder} onNew={()=>setScreen("new_order")}/>
      case "04_orders_designer":return <OrdersList role="designer"  onOrderClick={goOrder} onNew={()=>setScreen("new_order")}/>
      case "05_orders_sewing":  return <OrdersList role="sewing"    onOrderClick={goOrder} onNew={()=>{}}/>
      case "06_orders_warehouse":return <OrdersList role="warehouse" onOrderClick={goOrder} onNew={()=>{}}/>
      case "07_orders_installer":return <OrdersList role="installer" onOrderClick={goOrder} onNew={()=>{}}/>
      case "08_designer_detail":return <S08_DesignerMeasurements onBack={()=>setScreen("map")} onAdd={()=>setScreen("17_create_meas")} setScreen={setScreen}/>
      case "09_sewing_detail":  return <S09_SewingItems onBack={()=>setScreen("map")}/>
      case "10_installer_detail":return <S10_InstallerItems onBack={()=>setScreen("map")}/>
      case "11_admin_detail":   return <S11_AdminOrderDetail orderId={1} onBack={()=>setScreen("map")}/>
      case "15_create_order":   return <S15_CreateOrder mode="create" onBack={()=>setScreen("map")}/>
      case "16_edit_order":     return <S15_CreateOrder mode="edit"   onBack={()=>setScreen("map")}/>
      case "17_create_meas":    return <S17_CreateMeasurement mode="create" onBack={()=>setScreen("map")}/>
      case "18_edit_meas":      return <S17_CreateMeasurement mode="edit"   onBack={()=>setScreen("map")}/>
      case "orders":            return <OrdersList role={role} onOrderClick={goOrder} onNew={()=>setScreen("new_order")}/>
      case "order_detail":      return getOrderDetailScreen()
      case "new_order":         return <S15_CreateOrder mode="create" onBack={()=>setScreen("orders")}/>
      case "new_meas":          return <S17_CreateMeasurement mode="create" onBack={()=>setScreen("order_detail")}/>
      default: return null
    }
  }

  const isBack=!["map","orders","02_dashboard","01_login","03_orders_admin","04_orders_designer","05_orders_sewing","06_orders_warehouse","07_orders_installer"].includes(screen)

  return(
    <>
      <G/>
      {screen==="map"&&(
        <ScreenMap onSelect={s=>{setScreen(s);window.scrollTo(0,0)}}/>
      )}
      {screen!=="map"&&(
        <div className="app-shell">
          <div className={`sidebar-overlay${sidebarOpen?" show":""}`} onClick={close}/>
          <Sidebar screen={screen} setScreen={setScreen} role={role} setRole={setRole} open={sidebarOpen} close={close}/>
          <div className="main-content">
            {/* Mobile top bar */}
            <div className="mobile-topbar">
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                {isBack
                  ?<Btn v="ghost" icon={<ChevronRight size={16} style={{transform:"rotate(180deg)"}}/>} onClick={()=>setScreen("map")}/>
                  :<Btn v="ghost" icon={<Menu size={16}/>} onClick={()=>setSidebarOpen(true)}/>}
                <div style={{fontWeight:600,fontSize:15,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{screenList.find(s=>s.id===screen)?.label||"Sheber ERP"}</div>
              </div>
              <Btn v="secondary" sz="sm" icon={<Grid size={13}/>} onClick={()=>setScreen("map")}>Карта</Btn>
            </div>
            {/* Desktop "back to map" bar */}
            <div style={{display:"none"}} className="desktop-mapbar">
              <Btn v="ghost" sz="sm" icon={<Grid size={13}/>} onClick={()=>setScreen("map")}>← Карта экранов</Btn>
            </div>
            <style>{`@media(min-width:768px){.desktop-mapbar{display:flex;padding:10px 20px;border-bottom:1px solid var(--border);background:var(--card)}}`}</style>
            {renderScreen()}
          </div>
          <div className="mobile-bottom-nav">
            <button className={`mbn-item${screen==="map"?" active":""}`} onClick={()=>setScreen("map")}><Grid size={20}/><span>Карта</span></button>
            <button className={`mbn-item${screen==="orders"?" active":""}`} onClick={()=>setScreen("orders")}><ClipboardList size={20}/><span>Заказы</span></button>
            {["admin","designer"].includes(role)&&<button className={`mbn-item${screen==="new_order"?" active":""}`} onClick={()=>setScreen("new_order")}><Plus size={20}/><span>Создать</span></button>}
          </div>
        </div>
      )}
    </>
  )
}
